import { pendingOccurrencesForDay, parisDate } from '../../src/tasks/task-reminder-occurrences';
import { RepeatMode, Task, TaskStatus } from '../../src/tasks/task.entity';

describe('Reminder occurrences', () => {
  const now = new Date('2026-09-25T07:00:00Z'); // Friday
  const task = (patch: Partial<Task> = {}) => ({
    dueAt: new Date('2026-09-01T10:00:00Z'), isRepeat: true,
    repeatMode: RepeatMode.DAILY, status: TaskStatus.PENDING, ...patch,
  }) as Task;

  it.each([
    [RepeatMode.DAILY, true],
    [RepeatMode.EVERY_2_DAYS, true],
    [RepeatMode.WEEKLY, true],
    [RepeatMode.EVERY_X_WEEKS, false],
  ])('handles %s with the same UTC week anchor as the calendar', (repeatMode, expected) => {
    expect(pendingOccurrencesForDay(task({ repeatMode, repeatDays: ['FRI'], repeatEveryWeeks: 2 }), now).length > 0).toBe(expected);
  });

  it('matches every X weeks on an active week and rejects unselected weekdays', () => {
    const t = task({ repeatMode: RepeatMode.EVERY_X_WEEKS, repeatDays: ['FRI'], repeatEveryWeeks: 2 });
    expect(pendingOccurrencesForDay(t, new Date('2026-09-18T07:00:00Z'))).toHaveLength(1);
    expect(pendingOccurrencesForDay(t, new Date('2026-09-19T07:00:00Z'))).toHaveLength(0);
  });

  it('rejects off days of an every-two-days series', () => {
    expect(pendingOccurrencesForDay(task({ repeatMode: RepeatMode.EVERY_2_DAYS }), new Date('2026-09-26T07:00:00Z'))).toEqual([]);
  });

  it('excludes completed occurrences and respects the exclusive end of a series', () => {
    expect(pendingOccurrencesForDay(task({ completedOccurrences: ['2026-09-25T10:00:00.000Z'] }), now)).toEqual([]);
    expect(pendingOccurrencesForDay(task({ repeatEndAt: new Date('2026-09-25T10:00:00Z') }), now)).toEqual([]);
  });

  it('does not generate occurrences before the beginning of a series', () => {
    expect(pendingOccurrencesForDay(task({ dueAt: new Date('2026-09-26T10:00:00Z') }), now)).toEqual([]);
  });

  it('selects a Paris day rather than a UTC day, including midnight boundaries', () => {
    const t = task({ isRepeat: false, dueAt: new Date('2026-09-24T22:30:00Z') });
    expect(pendingOccurrencesForDay(t, now)).toHaveLength(1);
    expect(pendingOccurrencesForDay(task({ isRepeat: false, dueAt: new Date('2026-09-25T22:30:00Z') }), now)).toHaveLength(0);
  });

  it.each(['2026-03-29T07:00:00Z', '2026-10-25T08:00:00Z'])('handles DST transition %s', (date) => {
    const day = new Date(date);
    const occurrences = pendingOccurrencesForDay(task({ dueAt: new Date('2026-01-01T23:30:00Z') }), day);
    expect(occurrences).toHaveLength(1);
    expect(parisDate(occurrences[0])).toBe(parisDate(day));
  });

  it('excludes completed one-off tasks', () => {
    expect(pendingOccurrencesForDay(task({ isRepeat: false, dueAt: now, status: TaskStatus.DONE }), now)).toEqual([]);
  });
});
