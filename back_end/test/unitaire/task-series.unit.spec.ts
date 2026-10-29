import { TaskService } from '../../src/tasks/task.service';
import { RepeatMode,TaskStatus,TaskType } from '../../src/tasks/task.entity';
describe('Recurring task editing scope',()=>{
  let task:any;let repo:any;let service:TaskService;
  beforeEach(()=>{
    task={id:41,user:{id:1},aquarium:{id:1,name:'Bac'},title:'Routine',description:'Ancienne note',
      type:TaskType.OTHER,status:TaskStatus.PENDING,dueAt:new Date('2026-10-01T09:00:00Z'),
      isRepeat:true,repeatMode:RepeatMode.WEEKLY,repeatDays:['THU'],repeatEndAt:new Date('2026-12-24T09:00:00Z'),completedOccurrences:['2026-10-08T09:00:00.000Z'],fertilizers:[]};
    const qb:any={};for(const name of ['leftJoin','leftJoinAndSelect','where','andWhere','orderBy'])qb[name]=jest.fn(()=>qb);
    qb.getMany=jest.fn(async()=>[task]);
    repo={createQueryBuilder:()=>qb,findOne:jest.fn(async()=>task),save:jest.fn(async(t:any)=>t),delete:jest.fn(async()=>({affected:1}))};
    service=new TaskService(repo,{} as any,{} as any,{touchActivity:jest.fn(async()=>{})} as any,{} as any);
  });
  it('returns the original series date on every virtual occurrence',async()=>{
    const rows=await service.findMine(1,'2026-10');
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.every((row:any)=>row.seriesDueAt==='2026-10-01T09:00:00.000Z' && row.parentId===41)).toBe(true);
  });
  it('rejects content edits through occurrence IDs without moving the series',async()=>{
    await expect(service.update(1,'r:41:2026-10-29T09:00:00.000Z',{title:'Renommée',dueAt:'2026-10-29T09:00:00.000Z'})).rejects.toThrow('série');
    expect(repo.save).not.toHaveBeenCalled();
    expect(task.dueAt.toISOString()).toBe('2026-10-01T09:00:00.000Z');
  });
  it('preserves dates, earlier and completed occurrences when renaming the series and clearing a note',async()=>{
    await service.update(1,'41',{title:'Routine renommée',description:'',dueAt:'2026-10-01T09:00:00.000Z',repeat:{mode:RepeatMode.WEEKLY,days:['THU'] as any,durationWeeks:12}});
    expect(task.description).toBe('');
    expect(task.repeatEndAt.toISOString()).toBe('2026-12-24T09:00:00.000Z');
    const rows=await service.findMine(1,'2026-10');
    expect(rows.find((row:any)=>row.dueAt==='2026-10-08T09:00:00.000Z')?.status).toBe(TaskStatus.DONE);
    expect(rows.some((row:any)=>row.dueAt==='2026-10-01T09:00:00.000Z')).toBe(true);
  });
  it('does not delete a series via an occurrence ID',async()=>{
    await expect(service.remove(1,'r:41:2026-10-29T09:00:00.000Z')).rejects.toThrow('toute la série');
    expect(repo.delete).not.toHaveBeenCalled();
    await service.remove(1,'41');expect(repo.delete).toHaveBeenCalledWith(41);
  });
  it('rejects completing the template itself rather than an occurrence',async()=>{
    await expect(service.update(1,'41',{status:TaskStatus.DONE})).rejects.toThrow('occurrence');
    expect(task.status).toBe(TaskStatus.PENDING);
    expect(task.completedOccurrences).toEqual(['2026-10-08T09:00:00.000Z']);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
