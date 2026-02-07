import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';

import { UsersService } from '../../src/users/users.service';
import { User } from '../../src/users/user.entity';

// ✅ entités injectées dans UsersService
import { Aquarium } from '../../src/aquariums/aquariums.entity';
import { WaterMeasurement } from '../../src/water-measurement/water-measurement.entity';
import { Task } from '../../src/tasks/task.entity';
import { AquariumFishCard } from '../../src/catalog/aquarium-card-pivot/aquarium-fish-card.entity';
import { AquariumPlantCard } from '../../src/catalog/aquarium-card-pivot/aquarium-plant-card.entity';

jest.mock('argon2', () => ({
  hash: jest.fn(async (s: string) => 'hashed:' + s),
  verify: jest.fn(async (hash: string, plain: string) => hash === 'hashed:' + plain),
}));

describe('UsersService (unit)', () => {
  let service: UsersService;

  let repo: jest.Mocked<Repository<User>>;
  let aqRepo: jest.Mocked<Repository<Aquarium>>;
  let wmRepo: jest.Mocked<Repository<WaterMeasurement>>;
  let taskRepo: jest.Mocked<Repository<Task>>;
  let aqFishRepo: jest.Mocked<Repository<AquariumFishCard>>;
  let aqPlantRepo: jest.Mocked<Repository<AquariumPlantCard>>;

  beforeEach(async () => {
    const repoMock: Partial<jest.Mocked<Repository<User>>> = {
      findOne: jest.fn(),
      exist: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    // ✅ mocks minimalistes (suffisent pour ces tests unit)
    const aqRepoMock: Partial<jest.Mocked<Repository<Aquarium>>> = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const wmRepoMock: Partial<jest.Mocked<Repository<WaterMeasurement>>> = {
      find: jest.fn(),
    };

    const taskRepoMock: Partial<jest.Mocked<Repository<Task>>> = {
      find: jest.fn(),
    };

    const aqFishRepoMock: Partial<jest.Mocked<Repository<AquariumFishCard>>> = {
      find: jest.fn(),
    };

    const aqPlantRepoMock: Partial<jest.Mocked<Repository<AquariumPlantCard>>> = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,

        { provide: getRepositoryToken(User), useValue: repoMock },
        { provide: getRepositoryToken(Aquarium), useValue: aqRepoMock },
        { provide: getRepositoryToken(WaterMeasurement), useValue: wmRepoMock },
        { provide: getRepositoryToken(Task), useValue: taskRepoMock },
        { provide: getRepositoryToken(AquariumFishCard), useValue: aqFishRepoMock },
        { provide: getRepositoryToken(AquariumPlantCard), useValue: aqPlantRepoMock },
      ],
    }).compile();

    service = module.get(UsersService);

    repo = module.get(getRepositoryToken(User));
    aqRepo = module.get(getRepositoryToken(Aquarium));
    wmRepo = module.get(getRepositoryToken(WaterMeasurement));
    taskRepo = module.get(getRepositoryToken(Task));
    aqFishRepo = module.get(getRepositoryToken(AquariumFishCard));
    aqPlantRepo = module.get(getRepositoryToken(AquariumPlantCard));

    jest.clearAllMocks();
  });

  it('findById -> renvoie un user', async () => {
    repo.findOne.mockResolvedValue({ id: 1 } as any);

    const res = await service.findById(1);

    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(res).toEqual({ id: 1 });
  });

  describe('create', () => {
    it('lève Conflict si email déjà pris', async () => {
      repo.exist.mockResolvedValue(true);

      await expect(
        service.create({
          email: 'a@a.com',
          fullName: 'John',
          password: 'test123',
        } as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('crée un utilisateur avec hash du mot de passe + trim fullName', async () => {
      repo.exist.mockResolvedValue(false);
      (repo.create as jest.Mock).mockImplementation((x: any) => x);
      (repo.save as jest.Mock).mockImplementation(async (x: any) => ({ id: 10, ...x }));

      const res = await service.create({
        email: 'a@a.com',
        fullName: '  Jane  ',
        password: 'secret123',
      } as any);

      expect(res.id).toBe(10);
      expect(res.fullName).toBe('Jane');
      expect(res.password).toBe('hashed:secret123');
      expect(argon2.hash).toHaveBeenCalledWith('secret123');
    });

    it('si fullName vide -> fallback sur email avant @', async () => {
      repo.exist.mockResolvedValue(false);
      (repo.create as jest.Mock).mockImplementation((x: any) => x);
      (repo.save as jest.Mock).mockImplementation(async (x: any) => ({ id: 11, ...x }));

      const res = await service.create({
        email: 'johnny@test.com',
        fullName: '   ',
        password: 'pw',
      } as any);

      expect(res.fullName).toBe('johnny');
      expect(res.password).toBe('hashed:pw');
    });
  });

  describe('updateProfile', () => {
    it('NotFound si user introuvable', async () => {
      repo.findOne.mockResolvedValue(null as any);

      await expect(service.updateProfile(1, { fullName: 'X' } as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(repo.update).not.toHaveBeenCalled();
    });

    it('met à jour fullName (trim) et renvoie findById()', async () => {
      // 1) premier findOne : user existant
      repo.findOne.mockResolvedValueOnce({
        id: 1,
        fullName: 'Old',
        email: 'a@a.com',
      } as any);

      // 2) update ok
      (repo.update as jest.Mock).mockResolvedValue({} as any);

      // 3) findById -> findOne (deuxième appel)
      repo.findOne.mockResolvedValueOnce({
        id: 1,
        fullName: 'Updated',
        email: 'a@a.com',
      } as any);

      const res = await service.updateProfile(1, { fullName: '  Updated  ' } as any);

      expect(repo.update).toHaveBeenCalledWith({ id: 1 }, { fullName: 'Updated' });
      expect(res).toEqual({ id: 1, fullName: 'Updated', email: 'a@a.com' });
    });

    it('si email change et déjà utilisé -> Conflict', async () => {
      repo.findOne.mockResolvedValueOnce({
        id: 1,
        fullName: 'Old',
        email: 'old@test.com',
      } as any);

      repo.exist.mockResolvedValue(true);

      await expect(service.updateProfile(1, { email: 'new@test.com' } as any)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(repo.update).not.toHaveBeenCalled();
    });

    it('si patch vide -> renvoie user tel quel (pas de update)', async () => {
      repo.findOne.mockResolvedValueOnce({
        id: 1,
        fullName: 'Same',
        email: 'same@test.com',
      } as any);

      const res = await service.updateProfile(1, {} as any);

      expect(repo.update).not.toHaveBeenCalled();
      expect(res).toEqual({ id: 1, fullName: 'Same', email: 'same@test.com' });
    });
  });

  describe('changePassword', () => {
    it('retourne false si user introuvable', async () => {
      const qb: any = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const res = await service.changePassword(1, 'old', 'new');

      expect(res).toBe(false);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('retourne false si mot de passe invalide', async () => {
      const qb: any = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1, password: 'hashed:other' }),
      };
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const res = await service.changePassword(1, 'wrong', 'new');

      expect(res).toBe(false);
      expect(repo.update).not.toHaveBeenCalled();
      expect(argon2.verify).toHaveBeenCalled();
    });

    it('met à jour le mot de passe si valide', async () => {
      const qb: any = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1, password: 'hashed:old' }),
      };
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);
      (repo.update as jest.Mock).mockResolvedValue({} as any);

      const ok = await service.changePassword(1, 'old', 'newpass');

      expect(ok).toBe(true);
      expect(argon2.verify).toHaveBeenCalledWith('hashed:old', 'old');
      expect(argon2.hash).toHaveBeenCalledWith('newpass');
      expect(repo.update).toHaveBeenCalledWith({ id: 1 }, { password: 'hashed:newpass' });
    });
  });

  it('findByEmailWithPassword -> renvoie le user', async () => {
    const qb: any = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 1, email: 'a@a.com', password: 'hashed:123' }),
    };
    (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    const res = await service.findByEmailWithPassword('a@a.com');

    expect(repo.createQueryBuilder).toHaveBeenCalledWith('u');
    expect(res).not.toBeNull();
    expect(res!.password).toBeDefined();
  });

  it('touchActivity -> update lastActivityAt', async () => {
    (repo.update as jest.Mock).mockResolvedValue({} as any);

    await service.touchActivity(1);

    expect(repo.update).toHaveBeenCalledWith(
      { id: 1 },
      expect.objectContaining({ lastActivityAt: expect.any(Date) }),
    );
  });

  it('deleteById -> supprime', async () => {
    (repo.delete as jest.Mock).mockResolvedValue({} as any);

    await service.deleteById(3);

    expect(repo.delete).toHaveBeenCalledWith(3);
  });
});
