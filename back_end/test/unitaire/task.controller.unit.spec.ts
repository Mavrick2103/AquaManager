import { Test, TestingModule } from '@nestjs/testing';
import { TaskController } from '../../src/tasks/task.controller';
import { TaskService } from '../../src/tasks/task.service';
import { CreateTaskDto } from '../../src/tasks/dto/create-task.dto';
import { UpdateTaskDto } from '../../src/tasks/dto/update-task.dto';
import { TaskStatus, TaskType } from '../../src/tasks/task.entity';
import { MailService } from '../../src/mail/mail.service';
import { mailServiceMock } from '../utils/mail.mock';

describe('TaskController (unit)', () => {
  let controller: TaskController;
  let service: jest.Mocked<TaskService>;

  const mockService: Partial<jest.Mocked<TaskService>> = {
    findMine: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const req = { user: { userId: 1 } } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [{ provide: TaskService, useValue: mockService },
        { provide: MailService, useValue: mailServiceMock },
      ],
    }).compile();

    controller = module.get(TaskController);
    service = module.get(TaskService) as any;
    jest.clearAllMocks();
  });

  it('GET /tasks -> list()', async () => {
    service.findMine.mockResolvedValue([{ id: 1 }] as any);
    const res = await controller.list(req, '2025-10');
    expect(service.findMine).toHaveBeenCalledWith(1, '2025-10');
    expect(res).toEqual([{ id: 1 }]);
  });

  it('POST /tasks -> create()', async () => {
    const dto: CreateTaskDto = {
      title: 'Changement eau',
      description: '50%',
      dueAt: '2025-10-01T10:00:00.000Z',
      aquariumId: 7,
      type: TaskType.WATER_CHANGE,
    };
    service.create.mockResolvedValue({ id: 10, ...dto } as any);
    const res = await controller.create(req, dto);
    expect(service.create).toHaveBeenCalledWith(1, dto);
    expect(res).toMatchObject({ id: 10 });
  });

  it('PATCH /tasks/:id -> update()', async () => {
    const dto: UpdateTaskDto = { status: TaskStatus.DONE };
    service.update.mockResolvedValue({ id: 5, status: TaskStatus.DONE } as any);
    const res = await controller.update(req, 5 as any, dto);
    expect(service.update).toHaveBeenCalledWith(1, 5, dto);
    expect(res).toEqual({ id: 5, status: TaskStatus.DONE });
  });

  it('DELETE /tasks/:id -> remove()', async () => {
    service.remove.mockResolvedValue({ ok: true } as any);
    const res = await controller.remove(req, 9 as any);
    expect(service.remove).toHaveBeenCalledWith(1, 9);
    expect(res).toEqual({ ok: true });
  });
});
