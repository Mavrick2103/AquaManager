import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CalendarComponent } from './calendar.component';
import { TasksService, Task } from '../../core/tasks.service';

describe('Calendar dates and loading', () => {
  let component: CalendarComponent;
  let api: jasmine.SpyObj<TasksService>;
  beforeEach(async () => {
    api=jasmine.createSpyObj('TasksService',['listWindow']);
    api.listWindow.and.resolveTo([]);
    await TestBed.configureTestingModule({imports:[CalendarComponent],providers:[provideRouter([]),{provide:TasksService,useValue:api}]}).compileComponents();
    const fixture=TestBed.createComponent(CalendarComponent);
    component=fixture.componentInstance;fixture.detectChanges();await fixture.whenStable();
  });
  it('groups and filters by the local day displayed to the user', async () => {
    const dueAt=new Date(2026,9,29,0,30).toISOString();
    const task={id:'1',title:'Test',type:'OTHER',status:'PENDING',dueAt} as Task;
    component.tasks.set([task]);
    expect(component.dayTasks(new Date(2026,9,29))).toEqual([task]);
    expect(component.dayTasks(new Date(2026,9,28))).toEqual([]);
    component.today=new Date(2026,9,29);
    component.dateFilter='TODAY';
    expect(component.filteredTasks).toEqual([task]);
  });
  it('ignores an older month response arriving after the selected month', async () => {
    let resolveOld!: (rows:Task[])=>void;
    let resolveNew!: (rows:Task[])=>void;
    const old=new Promise<Task[]>(resolve=>resolveOld=resolve);
    const next=new Promise<Task[]>(resolve=>resolveNew=resolve);
    api.listWindow.and.callFake((from:Date)=>from.getFullYear()===2020 ? old : from.getFullYear()===2021 ? next : Promise.resolve([]));
    component.currentMonth.set(new Date(2020,0,1));const first=component.reloadMonth();
    component.currentMonth.set(new Date(2021,1,1));const second=component.reloadMonth();
    const current={id:'2',dueAt:new Date(2021,1,15).toISOString()} as Task;
    resolveNew([current]);await second;
    resolveOld([{id:'1',dueAt:new Date(2020,0,15).toISOString()} as Task]);await first;
    expect(component.tasks()).toEqual([current]);
  });
  it('keeps the selected month when retrying after an error', async () => {
    component.currentMonth.set(new Date(2026,0,1));
    api.listWindow.and.rejectWith(new Error('offline'));
    await component.reloadMonth();
    expect(component.loadError).toBeTrue();
    expect(component.summaryError).toBeTrue();
    api.listWindow.and.resolveTo([]);
    await component.reloadMonth();
    expect(component.currentMonth().getMonth()).toBe(0);
    expect(component.loadError).toBeFalse();
    expect(component.summaryError).toBeFalse();
  });
});
