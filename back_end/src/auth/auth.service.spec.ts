import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

jest.mock('argon2', () => ({
  verify: jest.fn(async (hash: string, plain: string) => hash === 'hashed:' + plain),
}));

describe('AuthService (unit)', () => {
  let service: AuthService;
  let users: jest.Mocked<UsersService>;

  // Mock JwtService compatible via cast
  const jwtMock = {
    signAsync: jest.fn().mockResolvedValue('jwt-token'),
  } as unknown as JwtService;

  beforeEach(async () => {
    const usersMock: Partial<jest.Mocked<UsersService>> = {
      findByEmailWithPassword: jest.fn(),
      create: jest.fn(),
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

    (jwtMock.signAsync as unknown as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('lève Unauthorized si user introuvable', async () => {
      users.findByEmailWithPassword.mockResolvedValue(null as any);
      await expect(service.login('a@a.com', 'x')).rejects.toThrow('Email ou mot de passe invalide');
      expect(users.findByEmailWithPassword).toHaveBeenCalledWith('a@a.com');
    });

    it('lève Unauthorized si mot de passe invalide', async () => {
      users.findByEmailWithPassword.mockResolvedValue({
        id: 1, email: 'a@a.com', password: 'hashed:other', role: 'user',
      } as any);
      await expect(service.login('a@a.com', 'wrong')).rejects.toThrow('Email ou mot de passe invalide');
    });

    it('retourne un access_token si OK', async () => {
      users.findByEmailWithPassword.mockResolvedValue({
        id: 1, email: 'a@a.com', password: 'hashed:secret', role: 'user',
      } as any);

      const res = await service.login('a@a.com', 'secret');

      // ✅ on vérifie uniquement le payload (un seul arg a été passé)
      expect((jwtMock.signAsync as unknown as jest.Mock)).toHaveBeenCalledWith(
        { sub: 1, email: 'a@a.com', role: 'user' }
      );
      expect(res).toEqual({ access_token: 'jwt-token' });
    });
  });

  describe('register', () => {
    it('crée le user via UsersService et renvoie un DTO public', async () => {
      users.create.mockResolvedValue({
        id: 10, fullName: 'John', email: 'john@a.com',
      } as any);

      const res = await service.register({
        fullName: 'John', email: 'john@a.com', password: 'x',
      } as any);

      expect(users.create).toHaveBeenCalledWith({
        fullName: 'John', email: 'john@a.com', password: 'x',
      });
      expect(res).toEqual({ id: 10, fullName: 'John', email: 'john@a.com' });
    });
  });
});
