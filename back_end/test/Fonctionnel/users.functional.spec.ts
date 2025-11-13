import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';

import { UsersController } from '../../src/users/users.controller';
import { UsersService } from '../../src/users/users.service';
import { User } from '../../src/users/user.entity';

describe('Users (tests fonctionnels)', () => {
  let controller: UsersController;
  let service: UsersService;
  let repo: jest.Mocked<Repository<User>>;
  let qb: {
    addSelect: jest.Mock;
    where: jest.Mock;
    getOne: jest.Mock;
  };

  const req = { user: { userId: 1 } } as any;

  beforeEach(async () => {
    qb = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    const usersRepoMock: Partial<jest.Mocked<Repository<User>>> = {
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      exist: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: usersRepoMock },
      ],
    }).compile();

    controller = module.get(UsersController);
    service = module.get(UsersService);
    repo = module.get(getRepositoryToken(User));

    jest.clearAllMocks();
  });

  it('me() -> renvoie le profil sans le mot de passe', async () => {
    repo.findOne.mockResolvedValue({
      id: 1,
      fullName: 'John Doe',
      email: 'john@test.com',
      password: 'secret',
      role: 'USER',
    } as any);

    const result = await controller.me(req);

    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result).toMatchObject({
      id: 1,
      fullName: 'John Doe',
      email: 'john@test.com',
      role: 'USER',
    });
    expect((result as any).password).toBeUndefined();
  });

  it('me() -> 404 si utilisateur introuvable', async () => {
    repo.findOne.mockResolvedValue(null as any);

    await expect(controller.me(req)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateMe() -> met à jour le profil et renvoie le user sans mot de passe', async () => {
    const dto = { fullName: 'Nouveau Nom', email: 'new@test.com' };

    repo.update.mockResolvedValue({} as any);
    repo.findOne.mockResolvedValue({
      id: 1,
      fullName: 'Nouveau Nom',
      email: 'new@test.com',
      password: 'hash',
      role: 'USER',
    } as any);

    const result = await controller.updateMe(req, dto);

    expect(repo.update).toHaveBeenCalledWith({ id: 1 }, dto);
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result).toMatchObject({
      id: 1,
      fullName: 'Nouveau Nom',
      email: 'new@test.com',
      role: 'USER',
    });
    expect((result as any).password).toBeUndefined();
  });

  it('updateMe() -> 404 si utilisateur introuvable après update', async () => {
    repo.update.mockResolvedValue({} as any);
    repo.findOne.mockResolvedValue(null as any);

    await expect(
      controller.updateMe(req, { fullName: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('changePassword() -> OK si mot de passe actuel correct', async () => {
    const currentPassword = 'oldPassword123';
    const newPassword = 'newPassword456';

    const hash = await argon2.hash(currentPassword);

    qb.getOne.mockResolvedValue({
      id: 1,
      password: hash,
    } as any);

    repo.update.mockResolvedValue({} as any);

    const result = await controller.changePassword(req, {
      currentPassword,
      newPassword,
    });

    expect(repo.createQueryBuilder).toHaveBeenCalledWith('u');
    expect(qb.addSelect).toHaveBeenCalledWith('u.password');
    expect(qb.where).toHaveBeenCalledWith('u.id = :id', { id: 1 });
    expect(repo.update).toHaveBeenCalledWith(
      { id: 1 },
      expect.objectContaining({ password: expect.any(String) }),
    );
    expect(result).toEqual({ ok: true });
  });

  it('changePassword() -> BadRequest si mot de passe actuel invalide', async () => {
    const currentPassword = 'wrongPassword';
    const realPassword = await argon2.hash('realPassword123');

    qb.getOne.mockResolvedValue({
      id: 1,
      password: realPassword,
    } as any);

    await expect(
      controller.changePassword(req, {
        currentPassword,
        newPassword: 'newPassword456',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('changePassword() -> BadRequest si utilisateur introuvable', async () => {
    qb.getOne.mockResolvedValue(null as any);

    await expect(
      controller.changePassword(req, {
        currentPassword: 'anything',
        newPassword: 'newPassword456',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('removeMe() -> supprime l’utilisateur connecté et renvoie { ok: true }', async () => {
    const localReq = { user: { userId: 5 } } as any;
    repo.delete.mockResolvedValue({} as any);

    const result = await controller.removeMe(localReq);

    expect(repo.delete).toHaveBeenCalledWith(5);
    expect(result).toEqual({ ok: true });
  });
});
