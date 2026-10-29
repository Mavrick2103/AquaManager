import { addDays, format, startOfDay, startOfMonth } from 'date-fns';
import { Task } from './tasks.service';

export function taskOverview(tasks: Task[], now: Date) {
  const today = startOfDay(now);
  const end = addDays(now, 7);
  const monthStart = startOfMonth(now);
  const pending = tasks.filter(task => task.status === 'PENDING' && Number.isFinite(Date.parse(task.dueAt)));
  const upcoming = pending.filter(task => new Date(task.dueAt) >= now && new Date(task.dueAt) <= end)
    .sort((a,b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  const completed = tasks.filter(task => task.status === 'DONE' && new Date(task.dueAt) >= addDays(today,-7) && new Date(task.dueAt) <= now)
    .sort((a,b) => Date.parse(b.dueAt) - Date.parse(a.dueAt));
  return {
    todayCount: pending.filter(task => format(new Date(task.dueAt), 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')).length,
    overdueCount: pending.filter(task => new Date(task.dueAt) >= monthStart && new Date(task.dueAt) < now).length,
    upcomingCount: upcoming.length,
    upcoming: upcoming.slice(0,5), completed: completed.slice(0,5),
  };
}
