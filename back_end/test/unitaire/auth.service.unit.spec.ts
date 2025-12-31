import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../src/auth/auth.service';
import { UsersService } from '../../src/users/users.service';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../../src/mail/mail.service';
import { mailServiceMock } from '../utils/mail.mock';

// Mock argon2.verify
jest.mock('argon2', () => ({
  verify: jest.fn(async (hash: string, plain: string) => hash === 'hashed:' + plain),
}));

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<UsersService>;
  let jwt: jest.Mocked<JwtService>;
  let configMock: { get: jest.Mock };

  beforeEach(async () => {
    const usersMock: Partial<jest.Mocked<UsersService>> = {
      findByEmailWithPassword: jest.fn(),
      create: jest.fn(),

      // ✅ nouvelles méthodes nécessaires
      setEmailVerifyToken: jest.fn().mockResolvedValue(undefined),
      verifyEmailByTokenHash: jest.fn().mockResolvedValue(null),

      setPasswordResetToken: jest.fn().mockResolvedValue(null),
      resetPasswordByTokenHash: jest.fn().mockResolvedValue(null),
    };

    const jwtMock: Partial<jest.Mocked<JwtService>> = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    configMock = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_EXPIRES') return '15m';
        if (key === 'JWT_REFRESH_EXPIRES') return '15d';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: ConfigService, useValue: configMock },
        { provide: MailService, useValue: mailServiceMock },
      ],
    }).compile();

    service = module.get(AuthService);
    users = module.get(UsersService) as any;
    jwt = module.get(JwtService) as any;

    jest.clearAllMocks();
  });

  describe('login', () => {
    it('jette Unauthorized si user introuvable', async () => {
      users.findByEmailWithPassword.mockResolvedValue(null);

      await expect(service.login('test@mail.com', 'secret')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(users.findByEmailWithPassword).toHaveBeenCalledWith('test@mail.com');
    });

    it('jette Unauthorized si email non vérifié', async () => {
      users.findByEmailWithPassword.mockResolvedValue({
        id: 1,
        email: 'test@mail.com',
        password: 'hashed:secret',
        role: 'USER',
        emailVerifiedAt: null, // ✅ non vérifié
      } as any);

      await expect(service.login('test@mail.com', 'secret')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('jette Unauthorized si mot de passe invalide', async () => {
      users.findByEmailWithPassword.mockResolvedValue({
        id: 1,
        email: 'test@mail.com',
        password: 'hashed:other',
        role: 'USER',
        emailVerifiedAt: new Date(), // ✅ vérifié
      } as any);

      await expect(service.login('test@mail.com', 'secret')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('retourne access + refresh si OK', async () => {
      users.findByEmailWithPassword.mockResolvedValue({
        id: 1,
        email: 'test@mail.com',
        password: 'hashed:secret',
        role: 'user',
        emailVerifiedAt: new Date(), // ✅ obligatoire maintenant
      } as any);

      jwt.signAsync
        .mockResolvedValueOnce('ACCESS_TOKEN')
        .mockResolvedValueOnce('REFRESH_TOKEN');

      const res = await service.login('test@mail.com', 'secret');

      expect(users.findByEmailWithPassword).toHaveBeenCalledWith('test@mail.com');
      expect(jwt.signAsync).toHaveBeenCalledTimes(2);
      expect(res).toEqual({ access: 'ACCESS_TOKEN', refresh: 'REFRESH_TOKEN' });
    });
  });

  describe('signAccess / signRefresh', () => {
    it('signAccess appelle JwtService.signAsync avec JWT_EXPIRES', async () => {
      const payload = { sub: 1, role: 'USER' };
      jwt.signAsync.mockResolvedValue('ACCESS');

      const token = await service.signAccess(payload);

      expect(configMock.get).toHaveBeenCalledWith('JWT_EXPIRES');
      expect(jwt.signAsync).toHaveBeenCalledWith(payload, { expiresIn: '15m' });
      expect(token).toBe('ACCESS');
    });

    it('signRefresh appelle JwtService.signAsync avec JWT_REFRESH_EXPIRES', async () => {
      const payload = { sub: 1, role: 'USER' };
      jwt.signAsync.mockResolvedValue('REFRESH');

      const token = await service.signRefresh(payload);

      expect(configMock.get).toHaveBeenCalledWith('JWT_REFRESH_EXPIRES');
      expect(jwt.signAsync).toHaveBeenCalledWith(payload, { expiresIn: '15d' });
      expect(token).toBe('REFRESH');
    });
  });

  describe('verifyRefresh', () => {
    it('délègue à jwt.verifyAsync et retourne le payload', async () => {
      const payload = { sub: 1, role: 'USER' };
      jwt.verifyAsync.mockResolvedValue(payload as any);

      const res = await service.verifyRefresh('TOKEN');

      expect(jwt.verifyAsync).toHaveBeenCalledWith('TOKEN');
      expect(res).toBe(payload);
    });
  });

  describe('register', () => {
    it('appelle UsersService.create, setEmailVerifyToken, sendVerifyEmail et retourne infos publiques', async () => {
      users.create.mockResolvedValue({
        id: 1,
        fullName: 'John Doe',
        email: 'john@doe.com',
      } as any);

      const dto = { fullName: 'John Doe', email: 'john@doe.com', password: 'secret' } as any;
      const res = await service.register(dto);

      expect(users.create).toHaveBeenCalledWith(dto);
      expect(users.setEmailVerifyToken).toHaveBeenCalledTimes(1);
      expect(mailServiceMock.sendVerifyEmail).toHaveBeenCalledTimes(1);

      expect(res).toEqual({
        id: 1,
        fullName: 'John Doe',
        email: 'john@doe.com',
        message: expect.any(String),
      });
    });
  });
});
