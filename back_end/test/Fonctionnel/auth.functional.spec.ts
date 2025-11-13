// test/Fonctionnel/auth.functional.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';
import { UsersService } from '../../src/users/users.service';
import { CreateUserDto } from '../../src/users/dto/create-user.dto';

// On mock argon2 pour contrôler la vérification de mot de passe
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

  beforeEach(async () => {
    // On configure des variables d’env pour les expirations (utilisées dans signAccess/signRefresh)
    process.env.JWT_EXPIRES = '1h';
    process.env.JWT_REFRESH_EXPIRES = '7d';
    process.env.JWT_SECRET = 'testsecret_min_16_chars';

    const usersMock: Partial<jest.Mocked<UsersService>> = {
      findByEmailWithPassword: jest.fn(),
      create: jest.fn(),
    };

    const jwtMock: Partial<jest.Mocked<JwtService>> = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    controller = module.get(AuthController);
    auth = module.get(AuthService);
    users = module.get(UsersService) as any;
    jwt = module.get(JwtService) as any;

    jest.clearAllMocks();
  });

  it('login() -> génère un access token et pose le refresh token en cookie', async () => {
    // user trouvé avec mot de passe hashé
    users.findByEmailWithPassword.mockResolvedValue({
      id: 1,
      email: 'test@mail.com',
      password: 'hashed:secret123',
      role: 'USER',
    } as any);

    // premier signAsync = access, deuxième = refresh
    let call = 0;
    jwt.signAsync.mockImplementation(async () => {
      call++;
      return call === 1 ? 'ACCESS_TOKEN' : 'REFRESH_TOKEN';
    });

    const res: any = { cookie: jest.fn() };

    const body = { email: 'test@mail.com', password: 'secret123' };
    const result = await controller.login(body, res);

    // vérifie la chaîne fonctionnelle login
    expect(users.findByEmailWithPassword).toHaveBeenCalledWith('test@mail.com');
    expect(argon2.verify).toHaveBeenCalledWith('hashed:secret123', 'secret123');
    expect(jwt.signAsync).toHaveBeenCalledTimes(2); // access + refresh

    // vérifie la pose du cookie de refresh
    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'REFRESH_TOKEN',
      expect.objectContaining({
        httpOnly: true,
        path: '/api/auth/refresh',
      }),
    );

    // corps de réponse = access_token
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

  it('login() -> Unauthorized si mot de passe invalide', async () => {
    users.findByEmailWithPassword.mockResolvedValue({
      id: 1,
      email: 'test@mail.com',
      password: 'hashed:otherpassword',
      role: 'USER',
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

    // on mocke verifyRefresh pour qu’il rejette
    jest.spyOn(auth, 'verifyRefresh').mockRejectedValue(new Error('invalid'));

    const result = await controller.refresh(req, res);

    expect(auth.verifyRefresh).toHaveBeenCalledWith('BAD_TOKEN');
    expect(result).toEqual({ access_token: null });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('refresh() -> génère un nouvel access token + refresh token et met à jour le cookie', async () => {
    const req: any = { cookies: { refresh_token: 'OLD_REFRESH' } };
    const res: any = { cookie: jest.fn() };

    // payload du refresh décodé
    jest.spyOn(auth, 'verifyRefresh').mockResolvedValue({
      sub: 1,
      role: 'USER',
    } as any);

    // signAccess / signRefresh utilisent tous deux jwt.signAsync
    let call = 0;
    jwt.signAsync.mockImplementation(async () => {
      call++;
      return call === 1 ? 'NEW_ACCESS' : 'NEW_REFRESH';
    });

    const result = await controller.refresh(req, res);

    // verifyRefresh appelé avec l’ancien cookie
    expect(auth.verifyRefresh).toHaveBeenCalledWith('OLD_REFRESH');

    // 2 nouveaux tokens générés
    expect(jwt.signAsync).toHaveBeenCalledTimes(2);

    // cookie refresh mis à jour
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
    expect(result).toEqual({
      id: 1,
      fullName: 'John Doe',
      email: 'john@test.com',
    });
  });
});
