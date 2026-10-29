import { taskOverview } from './task-overview';
import { Task } from './tasks.service';
describe('Task overview', () => {
  const now = new Date(2026, 9, 29, 12);
  const task = (id: number, dueAt: Date, status: 'PENDING' | 'DONE' = 'PENDING') => ({ id, dueAt: dueAt.toISOString(), status, title: 'Entretien', type: 'OTHER' } as Task);
  it('keeps the full total, includes next month and limits only the displayed list', () => {
    const tasks = Array.from({length:8}, (_,i) => task(i, new Date(2026,10,1,9,i)));
    const overview = taskOverview(tasks,now);
    expect(overview.upcomingCount).toBe(8);
    expect(overview.upcoming.length).toBe(5);
  });
  it('excludes completed tasks from pending counts and counts overdue work this month', () => {
    const overview = taskOverview([
      task(1,new Date(2026,9,29,15)), task(2,new Date(2026,9,29,16),'DONE'),
      task(3,new Date(2026,9,20,9)),task(4,new Date(2026,8,20,9)),
      task(5,new Date(2026,9,28,9),'DONE'),
    ],now);
    expect(overview.todayCount).toBe(1);
    expect(overview.upcomingCount).toBe(1);
    expect(overview.overdueCount).toBe(1);
    expect(overview.completed.map(item=>item.id)).toEqual([5]);
  });
  it('counts an elapsed time today as overdue consistently with the calendar', () => {
    expect(taskOverview([task(1,new Date(2026,9,29,9))],now).overdueCount).toBe(1);
  });
});
