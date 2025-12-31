import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';
import { UsersService } from '../../src/users/users.service';
import { CreateUserDto } from '../../src/users/dto/create-user.dto';
import { MailService } from '../../src/mail/mail.service';
import { mailServiceMock } from '../utils/mail.mock';

// Mock argon2 pour contrôler la vérification de mot de passe
jest.mock('argon2', () => ({
  hash: jest.fn(async (plain: string) => 'hashed:' + plain),
  verify: jest.fn(async (hash: string, plain: string) => hash === 'hashed:' + plain),
}));

import * as argon2 from 'argon2';

describe('Auth (tests fonctionnels)', () => {
  let controller: AuthController;
  let auth: AuthService;
  let users: jest.Mocked<UsersService>;
  let jwt: jest.Mocked<JwtService>;
  let configMock: { get: jest.Mock };

  beforeEach(async () => {
    process.env.JWT_SECRET = 'testsecret_min_16_chars';

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
        if (key === 'JWT_EXPIRES') return '1h';
        if (key === 'JWT_REFRESH_EXPIRES') return '7d';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: ConfigService, useValue: configMock },
        { provide: MailService, useValue: mailServiceMock },
      ],
    }).compile();

    controller = module.get(AuthController);
    auth = module.get(AuthService);
    users = module.get(UsersService) as any;
    jwt = module.get(JwtService) as any;

    jest.clearAllMocks();
  });

  it('login() -> génère un access token et pose le refresh token en cookie', async () => {
    users.findByEmailWithPassword.mockResolvedValue({
      id: 1,
      email: 'test@mail.com',
      password: 'hashed:secret123',
      role: 'USER',
      emailVerifiedAt: new Date(), // ✅ obligatoire maintenant
    } as any);

    let call = 0;
    jwt.signAsync.mockImplementation(async () => {
      call++;
      return call === 1 ? 'ACCESS_TOKEN' : 'REFRESH_TOKEN';
    });

    const res: any = { cookie: jest.fn() };
    const body = { email: 'test@mail.com', password: 'secret123' };

    const result = await controller.login(body, res);

    expect(users.findByEmailWithPassword).toHaveBeenCalledWith('test@mail.com');
    expect(argon2.verify).toHaveBeenCalledWith('hashed:secret123', 'secret123');
    expect(jwt.signAsync).toHaveBeenCalledTimes(2);

    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'REFRESH_TOKEN',
      expect.objectContaining({
        httpOnly: true,
        path: '/api/auth/refresh',
      }),
    );

    expect(result).toEqual({ access_token: 'ACCESS_TOKEN' });
  });

  it('login() -> Unauthorized si email inconnu', async () => {
    users.findByEmailWithPassword.mockResolvedValue(null as any);

    const res: any = { cookie: jest.fn() };

    await expect(
      controller.login({ email: 'unknown@mail.com', password: 'secret' }, res),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('login() -> Unauthorized si email non vérifié', async () => {
    users.findByEmailWithPassword.mockResolvedValue({
      id: 1,
      email: 'test@mail.com',
      password: 'hashed:secret123',
      role: 'USER',
      emailVerifiedAt: null, // ✅ non vérifié
    } as any);

    const res: any = { cookie: jest.fn() };

    await expect(
      controller.login({ email: 'test@mail.com', password: 'secret123' }, res),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('login() -> Unauthorized si mot de passe invalide', async () => {
    users.findByEmailWithPassword.mockResolvedValue({
      id: 1,
      email: 'test@mail.com',
      password: 'hashed:otherpassword',
      role: 'USER',
      emailVerifiedAt: new Date(), // ✅ vérifié
    } as any);

    const res: any = { cookie: jest.fn() };

    await expect(
      controller.login({ email: 'test@mail.com', password: 'wrong' }, res),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('refresh() -> renvoie access_token null si pas de cookie', async () => {
    const req: any = { cookies: {} };
    const res: any = { cookie: jest.fn() };

    const result = await controller.refresh(req, res);

    expect(result).toEqual({ access_token: null });
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
    expect(jwt.signAsync).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('refresh() -> renvoie access_token null si verifyRefresh échoue', async () => {
    const req: any = { cookies: { refresh_token: 'BAD_TOKEN' } };
    const res: any = { cookie: jest.fn() };

    jest.spyOn(auth, 'verifyRefresh').mockRejectedValue(new Error('invalid'));

    const result = await controller.refresh(req, res);

    expect(auth.verifyRefresh).toHaveBeenCalledWith('BAD_TOKEN');
    expect(result).toEqual({ access_token: null });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('refresh() -> génère un nouvel access token + refresh token et met à jour le cookie', async () => {
    const req: any = { cookies: { refresh_token: 'OLD_REFRESH' } };
    const res: any = { cookie: jest.fn() };

    jest.spyOn(auth, 'verifyRefresh').mockResolvedValue({
      sub: 1,
      role: 'USER',
    } as any);

    let call = 0;
    jwt.signAsync.mockImplementation(async () => {
      call++;
      return call === 1 ? 'NEW_ACCESS' : 'NEW_REFRESH';
    });

    const result = await controller.refresh(req, res);

    expect(auth.verifyRefresh).toHaveBeenCalledWith('OLD_REFRESH');
    expect(jwt.signAsync).toHaveBeenCalledTimes(2);

    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'NEW_REFRESH',
      expect.objectContaining({
        httpOnly: true,
        path: '/api/auth/refresh',
      }),
    );

    expect(result).toEqual({ access_token: 'NEW_ACCESS' });
  });

  it('logout() -> clear le cookie refresh', async () => {
    const res: any = { clearCookie: jest.fn() };

    const result = await controller.logout(res);

    expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', {
      path: '/api/auth/refresh',
    });
    expect(result).toEqual({ message: 'ok' });
  });

  it('register() -> crée un utilisateur et renvoie un user sans mot de passe', async () => {
    const dto: CreateUserDto = {
      fullName: ' John Doe ',
      email: 'john@test.com',
      password: 'secret123',
    };

    users.create.mockResolvedValue({
      id: 1,
      fullName: 'John Doe',
      email: 'john@test.com',
      password: 'hashed:secret123',
      role: 'USER',
    } as any);

    const result = await controller.register(dto);

    expect(users.create).toHaveBeenCalledWith(dto);
    expect(users.setEmailVerifyToken).toHaveBeenCalledTimes(1);
    expect(mailServiceMock.sendVerifyEmail).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      id: 1,
      fullName: 'John Doe',
      email: 'john@test.com',
      message: expect.any(String),
    });
  });
});
