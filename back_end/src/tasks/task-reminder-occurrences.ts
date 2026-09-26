import { RepeatMode, Task, TaskStatus, WeekDayKey } from './task.entity';

export const REMINDER_TIME_ZONE = 'Europe/Paris';

export function parisDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: REMINDER_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Uses the calendar's UTC recurrence rules, then selects the Paris calendar day. */
export function pendingOccurrencesForDay(task: Task, now: Date): Date[] {
  const day = parisDate(now);
  const base = new Date(task.dueAt);
  if (!Number.isFinite(base.getTime())) return [];
  if (!task.isRepeat || task.repeatMode === RepeatMode.NONE) {
    return task.status === TaskStatus.PENDING && parisDate(base) === day ? [base] : [];
  }

  const completed = new Set(task.completedOccurrences ?? []);
  const result: Date[] = [];
  const baseDay = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate());
  // A Paris day overlaps at most two UTC days; include both sides of now.
  for (let offset = -1; offset <= 1; offset++) {
    const candidate = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset,
      base.getUTCHours(), base.getUTCMinutes(), base.getUTCSeconds(), base.getUTCMilliseconds(),
    ));
    if (candidate < base || parisDate(candidate) !== day) continue;
    if (task.repeatEndAt && candidate >= new Date(task.repeatEndAt)) continue;
    if (completed.has(candidate.toISOString())) continue;
    const diffDays = Math.round((Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth(), candidate.getUTCDate()) - baseDay) / 86_400_000);
    const weekday = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][candidate.getUTCDay()] as WeekDayKey;
    const selectedDay = (task.repeatDays ?? ['MON']).includes(weekday);
    const every = Number(task.repeatEveryWeeks ?? 2);
    const matches = task.repeatMode === RepeatMode.DAILY
      || (task.repeatMode === RepeatMode.EVERY_2_DAYS && diffDays % 2 === 0)
      || (task.repeatMode === RepeatMode.WEEKLY && selectedDay)
      || (task.repeatMode === RepeatMode.EVERY_X_WEEKS && selectedDay && every > 0 && Math.floor(diffDays / 7) % every === 0);
    if (matches) result.push(candidate);
  }
  return result.sort((a, b) => a.getTime() - b.getTime());
}
