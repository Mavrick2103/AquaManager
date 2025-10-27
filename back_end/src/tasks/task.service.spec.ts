import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

import { Task, TaskStatus, TaskType } from './task.entity';
import { TaskService } from './task.service';
import { Aquarium } from '../aquariums/aquariums.entity';

describe('TaskService (unit)', () => {
  let service: TaskService;
  let repo: jest.Mocked<Repository<Task>>;
  let aqRepo: jest.Mocked<Repository<Aquarium>>;

  beforeEach(async () => {
    const taskRepoMock: Partial<jest.Mocked<Repository<Task>>> = {
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    };

    const aqRepoMock: Partial<jest.Mocked<Repository<Aquarium>>> = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: getRepositoryToken(Task), useValue: taskRepoMock },
        { provide: getRepositoryToken(Aquarium), useValue: aqRepoMock },
      ],
    }).compile();

    service = module.get(TaskService);
    repo = module.get(getRepositoryToken(Task));
    aqRepo = module.get(getRepositoryToken(Aquarium));
  });

  function mockQB(results: any[]) {
    const chain: any = {
      leftJoin: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(results),
    } as unknown as SelectQueryBuilder<Task>;
    (repo.createQueryBuilder as jest.Mock).mockReturnValue(chain);
    return chain;
  }

  describe('findMine', () => {
    it('retourne les tâches du user (sans mois)', async () => {
      const qb = mockQB([{ id: 1 }]);
      const res = await service.findMine(42);
      expect(repo.createQueryBuilder).toHaveBeenCalledWith('t');
      expect(res).toEqual([{ id: 1 }]);
      expect(qb.where).toHaveBeenCalledWith('u.id = :userId', { userId: 42 });
    });

    it('applique le filtre mois si fourni', async () => {
      const qb = mockQB([]);
      await service.findMine(1, '2025-10');
      expect(qb.andWhere).toHaveBeenCalled(); // borne de date ajoutée
    });
  });

  describe('create', () => {
    it('404 si aquarium inexistant ou non autorisé', async () => {
      aqRepo.findOne.mockResolvedValue(null as any);
      await expect(service.create(1, {
        title: 'Changement eau',
        description: '50%',
        dueAt: '2025-10-01T10:00:00.000Z',
        aquariumId: 99,
        type: TaskType.WATER_CHANGE,
      })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('crée et sauvegarde une tâche', async () => {
      aqRepo.findOne.mockResolvedValue({ id: 7 } as any);
      (repo.create as jest.Mock).mockImplementation((x: any) => x);
      (repo.save as jest.Mock).mockImplementation(async (x: any) => ({ id: 10, ...x }));

      const res = await service.create(1, {
        title: 'Changement eau',
        description: '50%',
        dueAt: '2025-10-01T10:00:00.000Z',
        aquariumId: 7,
        type: TaskType.WATER_CHANGE,
      });

      expect(res.id).toBeDefined();
      expect(res.user).toEqual({ id: 1 });
      expect(res.aquarium).toEqual({ id: 7 });
      expect(res.status).toBe(TaskStatus.PENDING);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('404 si tâche non trouvée ou non appartenant au user', async () => {
      repo.findOne.mockResolvedValue(null as any);
      await expect(service.update(1, 23, {} as any)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('met à jour les champs simples', async () => {
      repo.findOne.mockResolvedValue({ id: 5, user: { id: 1 }, aquarium: { id: 7 } } as any);
      (repo.save as jest.Mock).mockImplementation(async (x: any) => x);

      const res = await service.update(1, 5, {
        title: 'Nouveau titre',
        status: TaskStatus.DONE,
      });

      expect(res.title).toBe('Nouveau titre');
      expect(res.status).toBe(TaskStatus.DONE);
      expect(repo.save).toHaveBeenCalled();
    });

    it("change d'aquarium en vérifiant l'appartenance", async () => {
      repo.findOne.mockResolvedValue({ id: 5, user: { id: 1 }, aquarium: { id: 7 } } as any);
      aqRepo.findOne.mockResolvedValue({ id: 8 } as any);
      (repo.save as jest.Mock).mockImplementation(async (x: any) => x);

      const res = await service.update(1, 5, { aquariumId: 8 });
      expect(res.aquarium).toEqual({ id: 8 });
    });

    it("404 si nouvel aquarium non autorisé", async () => {
      repo.findOne.mockResolvedValue({ id: 5, user: { id: 1 }, aquarium: { id: 7 } } as any);
      aqRepo.findOne.mockResolvedValue(null as any);
      await expect(service.update(1, 5, { aquariumId: 99 })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('404 si non trouvé ou non appartenant au user', async () => {
      repo.findOne.mockResolvedValue(null as any);
      await expect(service.remove(1, 9)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('supprime et renvoie ok:true', async () => {
      repo.findOne.mockResolvedValue({ id: 9, user: { id: 1 } } as any);
      (repo.delete as jest.Mock).mockResolvedValue({} as any);
      const res = await service.remove(1, 9);
      expect(repo.delete).toHaveBeenCalledWith(9);
      expect(res).toEqual({ ok: true });
    });
  });
});
