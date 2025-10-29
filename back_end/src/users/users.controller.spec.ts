import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('UsersController (unit)', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

  const mockService: Partial<jest.Mocked<UsersService>> = {
    findById: jest.fn(),
    updateProfile: jest.fn(),
    changePassword: jest.fn(),
    deleteById: jest.fn(),
  };

  const req = { user: { userId: 1 } } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockService }],
    }).compile();

    controller = module.get(UsersController);
    service = module.get(UsersService) as any;
    jest.clearAllMocks();
  });

  describe('GET /users/me', () => {
    it('retourne user sans password', async () => {
      service.findById.mockResolvedValue({ id: 1, email: 'a@a.com', password: 'secret' } as any);
      const res = await controller.me(req);
      expect(res).not.toHaveProperty('password');
      expect(service.findById).toHaveBeenCalledWith(1);
    });

    it('404 si user absent', async () => {
      service.findById.mockResolvedValue(null as any);
      await expect(controller.me(req)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('PUT /users/me', () => {
    it('met à jour le profil et supprime password', async () => {
      service.updateProfile.mockResolvedValue({ id: 1, email: 'a@a.com', password: 'xxx' } as any);
      const dto: UpdateMeDto = { fullName: 'Romain' };
      const res = await controller.updateMe(req, dto);
      expect(res).not.toHaveProperty('password');
      expect(service.updateProfile).toHaveBeenCalledWith(1, dto);
    });

    it('404 si user introuvable', async () => {
      service.updateProfile.mockResolvedValue(null as any);
      const dto: UpdateMeDto = { fullName: 'Romain' };
      await expect(controller.updateMe(req, dto)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('POST /users/me/password', () => {
    it('change le mot de passe (ok)', async () => {
      service.changePassword.mockResolvedValue(true);
      const dto: ChangePasswordDto = { currentPassword: 'a', newPassword: 'b' };
      const res = await controller.changePassword(req, dto);
      expect(res).toEqual({ ok: true });
      expect(service.changePassword).toHaveBeenCalledWith(1, 'a', 'b');
    });

    it('400 si mauvais mot de passe', async () => {
      service.changePassword.mockResolvedValue(false);
      const dto: ChangePasswordDto = { currentPassword: 'x', newPassword: 'y' };
      await expect(controller.changePassword(req, dto))
        .rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('DELETE /users/me', () => {
    it('supprime le compte', async () => {
      const res = await controller.removeMe(req);
      expect(service.deleteById).toHaveBeenCalledWith(1);
      expect(res).toEqual({ ok: true });
    });
  });
});
