import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from '../../src/auth/auth.service';
import { UsersService } from '../../src/users/users.service';

jest.mock('argon2', () => ({
  verify: jest.fn(async (hash: string, plain: string) => hash === 'hashed:' + plain),
}));

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<UsersService>;
  let jwt: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const usersMock: Partial<jest.Mocked<UsersService>> = {
      findByEmailWithPassword: jest.fn(),
      create: jest.fn(),
    };

    const jwtMock: Partial<jest.Mocked<JwtService>> = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    service = module.get(AuthService);
    users = module.get(UsersService) as any;
    jwt = module.get(JwtService) as any;

    jest.clearAllMocks();
    (jwt.signAsync as jest.Mock).mockImplementation(async (_payload, opt?: any) => {
      if (opt?.expiresIn?.toString().includes('d')) return 'refresh-token';
      return 'access-token';
    });
  });

  describe('login', () => {
    it('jette Unauthorized si user introuvable', async () => {
      users.findByEmailWithPassword.mockResolvedValue(null as any);

      await expect(service.login('a@a.com', 'x')).rejects.toThrow(UnauthorizedException);
      expect(users.findByEmailWithPassword).toHaveBeenCalledWith('a@a.com');
    });

    it('jette Unauthorized si mot de passe invalide', async () => {
      users.findByEmailWithPassword.mockResolvedValue({
        id: 1,
        email: 'a@a.com',
        password: 'hashed:other',
        role: 'user',
      } as any);

      await expect(service.login('a@a.com', 'bad')).rejects.toThrow(UnauthorizedException);
      expect(argon2.verify).toHaveBeenCalled();
    });

    it('retourne access + refresh si OK', async () => {
      users.findByEmailWithPassword.mockResolvedValue({
        id: 1,
        email: 'a@a.com',
        password: 'hashed:secret',
        role: 'USER',
      } as any);

      (jwt.signAsync as jest.Mock)
        .mockResolvedValueOnce('access-token')   // signAccess
        .mockResolvedValueOnce('refresh-token'); // signRefresh

      const res = await service.login('a@a.com', 'secret');

      expect(res).toEqual({ access: 'access-token', refresh: 'refresh-token' });

      const calls = (jwt.signAsync as jest.Mock).mock.calls;
      expect(calls.length).toBe(2);

      expect(calls[0][0]).toEqual(
        expect.objectContaining({ sub: 1, role: expect.stringMatching(/^user$/i) })
      );
      expect(calls[1][0]).toEqual(
        expect.objectContaining({ sub: 1, role: expect.stringMatching(/^user$/i) })
      );
    });
  });

  describe('signAccess / signRefresh', () => {
    it('signAccess appelle JwtService.signAsync (expiresIn peut être indéfini)', async () => {
      (jwt.signAsync as jest.Mock).mockResolvedValue('access-token');
      const payload = { sub: 1, email: 'a@a.com', role: 'user' };

      const token = await service.signAccess(payload);

      expect(token).toBe('access-token');
      expect(jwt.signAsync).toHaveBeenCalled();

      const [signedPayload, options] = (jwt.signAsync as jest.Mock).mock.calls[0];
      expect(signedPayload).toEqual(
        expect.objectContaining({ sub: 1, role: expect.stringMatching(/^user$/i) })
      );

      if (options && 'expiresIn' in options && options.expiresIn != null) {
        expect(typeof options.expiresIn).toBe('string');
      }
    });

    it('signRefresh appelle JwtService.signAsync (expiresIn peut être indéfini)', async () => {
      (jwt.signAsync as jest.Mock).mockResolvedValue('refresh-token');
      const payload = { sub: 1, email: 'a@a.com', role: 'user' };

      const token = await service.signRefresh(payload);

      expect(token).toBe('refresh-token');
      expect(jwt.signAsync).toHaveBeenCalled();

      const [signedPayload, options] = (jwt.signAsync as jest.Mock).mock.calls[0];
      expect(signedPayload).toEqual(
        expect.objectContaining({ sub: 1, role: expect.stringMatching(/^user$/i) })
      );

      if (options && 'expiresIn' in options && options.expiresIn != null) {
        expect(typeof options.expiresIn).toBe('string');
      }
    });
  });

  describe('verifyRefresh', () => {
    it('délègue à jwt.verifyAsync et retourne le payload', async () => {
      (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 1, email: 'a@a.com', role: 'user' });

      const payload = await service.verifyRefresh('refresh-token');
      expect(payload).toEqual({ sub: 1, email: 'a@a.com', role: 'user' });
      expect(jwt.verifyAsync).toHaveBeenCalledWith('refresh-token');
    });
  });
});
