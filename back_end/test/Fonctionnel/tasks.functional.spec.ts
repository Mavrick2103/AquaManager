import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

import { TaskController } from '../../src/tasks/task.controller';
import { TaskService } from '../../src/tasks/task.service';
import { Task, TaskStatus, TaskType } from '../../src/tasks/task.entity';
import { Aquarium } from '../../src/aquariums/aquariums.entity';

// ✅ ADAPTE CE CHEMIN SI BESOIN
import { TaskFertilizer } from '../../src/tasks/task-fertilizer.entity';

import { MailService } from '../../src/mail/mail.service';
import { mailServiceMock } from '../utils/mail.mock';

describe('Tasks (tests fonctionnels)', () => {
  let controller: TaskController;
  let service: TaskService;
  let repo: jest.Mocked<Repository<Task>>;
  let aqRepo: jest.Mocked<Repository<Aquarium>>;

  let qb: {
    leftJoin: jest.Mock;
    leftJoinAndSelect: jest.Mock;
    where: jest.Mock;
    orderBy: jest.Mock;
    andWhere: jest.Mock;
    getMany: jest.Mock;
  };

  const req = { user: { userId: 1 } } as any;

  beforeEach(async () => {
    qb = {
      leftJoin: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    const taskRepoMock: Partial<jest.Mocked<Repository<Task>>> = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const aqRepoMock: Partial<jest.Mocked<Repository<Aquarium>>> = {
      findOne: jest.fn(),
    };

    const taskFertilizerRepoMock: Partial<jest.Mocked<Repository<TaskFertilizer>>> = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [
        TaskService,
        { provide: getRepositoryToken(Task), useValue: taskRepoMock },
        { provide: getRepositoryToken(Aquarium), useValue: aqRepoMock },
        { provide: getRepositoryToken(TaskFertilizer), useValue: taskFertilizerRepoMock },
        { provide: MailService, useValue: mailServiceMock },
      ],
    }).compile();

    controller = module.get(TaskController);
    service = module.get(TaskService);
    repo = module.get(getRepositoryToken(Task));
    aqRepo = module.get(getRepositoryToken(Aquarium));

    jest.clearAllMocks();
  });

  it('list() -> renvoie les tâches du user sans filtrage de mois', async () => {
    const t1Due = new Date('2025-01-01T00:00:00.000Z');
    const t2Due = new Date('2025-01-02T00:00:00.000Z');

    // ⚠️ Le service mappe => id string + dueAt ISO string + champs additionnels
    const tasksFromDb = [
      { id: 1, title: 'Changement d’eau', dueAt: t1Due } as any,
      { id: 2, title: 'Test NO3', dueAt: t2Due } as any,
    ];

    qb.getMany.mockResolvedValue(tasksFromDb);

    const res = await controller.list(req);

    expect(repo.createQueryBuilder).toHaveBeenCalledWith('t');
    expect(qb.leftJoin).toHaveBeenCalledWith('t.user', 'u');
    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('t.aquarium', 'a');
    expect(qb.where).toHaveBeenCalledWith('u.id = :userId', { userId: 1 });
    expect(qb.orderBy).toHaveBeenCalledWith('t.dueAt', 'ASC');
    expect(qb.andWhere).not.toHaveBeenCalled();

    // ✅ On valide la forme de réponse mappée (pas l’entité brute)
    expect(res).toEqual([
      expect.objectContaining({
        id: '1',
        title: 'Changement d’eau',
        dueAt: t1Due.toISOString(),
      }),
      expect.objectContaining({
        id: '2',
        title: 'Test NO3',
        dueAt: t2Due.toISOString(),
      }),
    ]);
  });

  it('list() -> filtre les tâches par mois si month est fourni', async () => {
    const due = new Date('2025-03-10T10:00:00.000Z');

    // ✅ IMPORTANT : dueAt doit être une Date sinon toISOString() casse
    qb.getMany.mockResolvedValue([{ id: 3, title: 'Taille des plantes', dueAt: due } as any]);

    const res = await controller.list(req, '2025-03');

    expect(qb.andWhere).toHaveBeenCalled();
    expect(res).toEqual([
      expect.objectContaining({
        id: '3',
        title: 'Taille des plantes',
        dueAt: due.toISOString(),
      }),
    ]);
  });

  it('create() -> crée une tâche pour un aquarium appartenant au user', async () => {
  aqRepo.findOne.mockResolvedValue({
    id: 5,
    user: { id: 1 },
  } as any);

  repo.create.mockImplementation((partial: any) => partial as any);

  // save renvoie un truc, ok, MAIS ton service refait sûrement un findOne derrière
  repo.save.mockImplementation(async (t: any) => ({
    ...t,
    id: 10,
    dueAt: t.dueAt instanceof Date ? t.dueAt : new Date(t.dueAt),
  }));

  // ✅ IMPORTANT : ton service fait très probablement un repo.findOne(...) après save
  repo.findOne.mockResolvedValue({
    id: 10,
    title: 'Changement d’eau',
    description: '30 % du volume',
    dueAt: new Date('2025-01-15T10:00:00.000Z'),
    status: TaskStatus.PENDING,
    type: TaskType.WATER_CHANGE,
    aquarium: { id: 5 },
    user: { id: 1 },
    fertilizers: [],
  } as any);

  const dto = {
    title: 'Changement d’eau',
    description: '30 % du volume',
    dueAt: '2025-01-15T10:00:00.000Z',
    aquariumId: 5,
    type: TaskType.WATER_CHANGE,
  };

  const res = await controller.create(req, dto as any);

  expect(aqRepo.findOne).toHaveBeenCalledWith({
    where: { id: 5, user: { id: 1 } },
    relations: { user: true },
    select: { id: true } as any,
  });

  expect(repo.create).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Changement d’eau',
      description: '30 % du volume',
      user: { id: 1 },
      aquarium: expect.objectContaining({ id: 5 }),
      status: TaskStatus.PENDING,
      type: TaskType.WATER_CHANGE,
      dueAt: new Date('2025-01-15T10:00:00.000Z'),
    }),
  );

  // ✅ réponse mappée
  expect(res).toEqual(
    expect.objectContaining({
      id: '10',
      title: 'Changement d’eau',
      type: TaskType.WATER_CHANGE,
      dueAt: new Date('2025-01-15T10:00:00.000Z').toISOString(),
    }),
  );
});


  it('create() -> 404 si aquarium introuvable ou non autorisé', async () => {
    aqRepo.findOne.mockResolvedValue(null as any);

    await expect(
      controller.create(req, {
        title: 'Test',
        dueAt: '2025-01-01T00:00:00.000Z',
        aquariumId: 999,
        type: TaskType.OTHER,
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('update() -> met à jour les champs simples d’une tâche appartenant au user', async () => {
    const existing = {
      id: 7,
      title: 'Ancien titre',
      description: 'Ancienne desc',
      dueAt: new Date('2025-01-10T10:00:00.000Z'),
      status: TaskStatus.PENDING,
      type: TaskType.OTHER,
      user: { id: 1 },
      aquarium: { id: 5 },
      fertilizers: [],
    } as any;

    repo.findOne.mockResolvedValue(existing);
    repo.save.mockImplementation(async (t: any) => t);

    const dto = {
      title: 'Test de l’eau',
      description: 'Nouvelle description',
      dueAt: '2025-01-20T15:00:00.000Z',
      status: TaskStatus.DONE,
      type: TaskType.WATER_TEST,
    };

    const res = await controller.update(req, '7', dto as any);

    // ✅ ton service demande aussi fertilizers: true maintenant
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 7 },
      relations: { user: true, aquarium: true, fertilizers: true },
    });

    // ✅ réponse mappée
    expect(res).toEqual(
      expect.objectContaining({
        id: '7',
        title: 'Test de l’eau',
        description: 'Nouvelle description',
        status: TaskStatus.DONE,
        type: TaskType.WATER_TEST,
        dueAt: new Date('2025-01-20T15:00:00.000Z').toISOString(),
      }),
    );
  });

  it("update() -> change aussi d’aquarium si aquariumId est fourni et autorisé", async () => {
    const existing = {
      id: 8,
      title: 'Tâche',
      dueAt: new Date('2025-01-10T10:00:00.000Z'),
      user: { id: 1 },
      aquarium: { id: 5 },
      fertilizers: [],
    } as any;

    repo.findOne.mockResolvedValue(existing);

    aqRepo.findOne.mockResolvedValue({
      id: 6,
      user: { id: 1 },
    } as any);

    repo.save.mockImplementation(async (t: any) => t);

    const dto = { aquariumId: 6 };

    const res = await controller.update(req, '8', dto as any);

    expect(aqRepo.findOne).toHaveBeenCalledWith({
      where: { id: 6, user: { id: 1 } },
      relations: { user: true },
      select: { id: true } as any,
    });

    // ✅ réponse mappée : aquarium => { id, name? } ou undefined
    expect(res).toEqual(
      expect.objectContaining({
        id: '8',
      }),
    );
  });

  it("update() -> 404 si la tâche n’existe pas ou n’appartient pas au user", async () => {
    repo.findOne.mockResolvedValue(null as any);

    await expect(controller.update(req, '999', { title: 'X' } as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    repo.findOne.mockResolvedValue({ id: 9, user: { id: 2 } } as any);

    await expect(controller.update(req, '9', { title: 'Y' } as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('remove() -> supprime une tâche appartenant au user et renvoie { ok: true }', async () => {
    const task = { id: 12, user: { id: 1 } } as any;

    repo.findOne.mockResolvedValue(task);
    repo.delete.mockResolvedValue({} as any);

    const res = await controller.remove(req, '12');

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 12 },
      relations: { user: true },
    });

    expect(repo.delete).toHaveBeenCalledWith(12);
    expect(res).toEqual({ ok: true });
  });

  it("remove() -> 404 si la tâche n’existe pas ou n’appartient pas au user", async () => {
    repo.findOne.mockResolvedValue(null as any);

    await expect(controller.remove(req, '999')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.delete).not.toHaveBeenCalled();

    repo.findOne.mockResolvedValue({ id: 13, user: { id: 2 } } as any);

    await expect(controller.remove(req, '13')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
