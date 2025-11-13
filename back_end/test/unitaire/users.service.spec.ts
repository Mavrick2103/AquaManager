import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException } from '@nestjs/common';
import * as argon2 from 'argon2';

import { UsersService } from '../../src/users/users.service';
import { User } from '../../src/users/user.entity';

jest.mock('argon2', () => ({
  hash: jest.fn(async (s: string) => 'hashed:' + s),
  verify: jest.fn(async (hash: string, plain: string) => hash === 'hashed:' + plain),
}));

describe('UsersService (unit)', () => {
  let service: UsersService;
  let repo: jest.Mocked<Repository<User>>;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repoMock },
      ],
    }).compile();

    service = module.get(UsersService);
    repo = module.get(getRepositoryToken(User));
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
      (repo.exist as jest.Mock).mockResolvedValue(true);
      await expect(service.create({
        email: 'a@a.com',
        fullName: 'John',
        password: 'test123',
      } as any)).rejects.toBeInstanceOf(ConflictException);
    });

    it('crée un utilisateur avec hash du mot de passe', async () => {
      (repo.exist as jest.Mock).mockResolvedValue(false);
      (repo.create as jest.Mock).mockImplementation((x: any) => x);
      (repo.save as jest.Mock).mockImplementation(async (x: any) => ({ id: 10, ...x }));

      const res = await service.create({
        email: 'a@a.com',
        fullName: '  Jane  ',
        password: 'secret123',
      } as any);

      expect(res.id).toBe(10);
      expect(res.fullName).toBe('Jane');
      expect(res.password).toMatch(/^hashed:/);
      expect(argon2.hash).toHaveBeenCalledWith('secret123');
    });
  });

  describe('updateProfile', () => {
    it('appelle update() et renvoie findById()', async () => {
      (repo.update as jest.Mock).mockResolvedValue({} as any);
      repo.findOne.mockResolvedValue({ id: 1, fullName: 'Updated' } as any);
      const res = await service.updateProfile(1, { fullName: 'Updated' } as any);
      expect(repo.update).toHaveBeenCalledWith({ id: 1 }, { fullName: 'Updated' });
      expect(res).toEqual({ id: 1, fullName: 'Updated' });
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
      expect(repo.update).toHaveBeenCalled();
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

  it('deleteById -> supprime', async () => {
    await service.deleteById(3);
    expect(repo.delete).toHaveBeenCalledWith(3);
  });
});
