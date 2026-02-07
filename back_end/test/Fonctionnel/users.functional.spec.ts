import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { UsersController } from '../../src/users/users.controller';
import { UsersService } from '../../src/users/users.service';
import { MailService } from '../../src/mail/mail.service';
import { mailServiceMock } from '../utils/mail.mock';

describe('Users (tests fonctionnels)', () => {
  let controller: UsersController;

  const req = { user: { userId: 1 } } as any;

  const usersServiceMock = {
    findById: jest.fn(),
    updateProfile: jest.fn(),
    changePassword: jest.fn(),
    deleteById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersServiceMock },
        { provide: MailService, useValue: mailServiceMock },
      ],
    }).compile();

    controller = module.get(UsersController);
    jest.clearAllMocks();
  });

  it('me() -> renvoie le profil sans le mot de passe', async () => {
    usersServiceMock.findById.mockResolvedValue({
      id: 1,
      fullName: 'John Doe',
      email: 'john@test.com',
      password: 'secret',
      role: 'USER',
    });

    const result = await controller.me(req);

    expect(usersServiceMock.findById).toHaveBeenCalledWith(1);
    expect(result).toMatchObject({
      id: 1,
      fullName: 'John Doe',
      email: 'john@test.com',
      role: 'USER',
    });
    expect((result as any).password).toBeUndefined();
  });

  it('me() -> 404 si utilisateur introuvable', async () => {
    usersServiceMock.findById.mockResolvedValue(null);

    await expect(controller.me(req)).rejects.toBeInstanceOf(NotFoundException);
    expect(usersServiceMock.findById).toHaveBeenCalledWith(1);
  });

  it('updateMe() -> met à jour le profil et renvoie le user sans mot de passe', async () => {
    const dto = { fullName: 'Nouveau Nom', email: 'new@test.com' };

    usersServiceMock.updateProfile.mockResolvedValue({
      id: 1,
      fullName: 'Nouveau Nom',
      email: 'new@test.com',
      password: 'hash',
      role: 'USER',
    });

    const result = await controller.updateMe(req, dto as any);

    expect(usersServiceMock.updateProfile).toHaveBeenCalledWith(1, dto);
    expect(result).toMatchObject({
      id: 1,
      fullName: 'Nouveau Nom',
      email: 'new@test.com',
      role: 'USER',
    });
    expect((result as any).password).toBeUndefined();
  });

  it('updateMe() -> 404 si utilisateur introuvable (service renvoie null)', async () => {
    usersServiceMock.updateProfile.mockResolvedValue(null);

    await expect(controller.updateMe(req, { fullName: 'X' } as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(usersServiceMock.updateProfile).toHaveBeenCalledWith(1, { fullName: 'X' });
  });

  it('changePassword() -> OK si mot de passe actuel correct', async () => {
    usersServiceMock.changePassword.mockResolvedValue(true);

    const result = await controller.changePassword(req, {
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword456',
    } as any);

    expect(usersServiceMock.changePassword).toHaveBeenCalledWith(1, 'oldPassword123', 'newPassword456');
    expect(result).toEqual({ ok: true });
  });

  it('changePassword() -> BadRequest si mot de passe actuel invalide', async () => {
    usersServiceMock.changePassword.mockResolvedValue(false);

    await expect(
      controller.changePassword(req, {
        currentPassword: 'wrongPassword',
        newPassword: 'newPassword456',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(usersServiceMock.changePassword).toHaveBeenCalledWith(1, 'wrongPassword', 'newPassword456');
  });

  it('removeMe() -> supprime l’utilisateur connecté et renvoie { ok: true }', async () => {
    const localReq = { user: { userId: 5 } } as any;

    usersServiceMock.deleteById.mockResolvedValue(undefined);

    const result = await controller.removeMe(localReq);

    expect(usersServiceMock.deleteById).toHaveBeenCalledWith(5);
    expect(result).toEqual({ ok: true });
  });

  it('removeMe() -> accepte aussi req.user.sub', async () => {
    const localReq = { user: { sub: 9 } } as any;

    usersServiceMock.deleteById.mockResolvedValue(undefined);

    const result = await controller.removeMe(localReq);

    expect(usersServiceMock.deleteById).toHaveBeenCalledWith(9);
    expect(result).toEqual({ ok: true });
  });
});
