import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';
import { MailService } from '../../src/mail/mail.service';
import { mailServiceMock } from '../utils/mail.mock';
import { ThrottlerModule } from '@nestjs/throttler';

describe('AuthController', () => {
  let controller: AuthController;
  let service: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const serviceMock: Partial<jest.Mocked<AuthService>> = {
      login: jest.fn(),
      refreshTokens: jest.fn(),
      logout: jest.fn(),
      verifyRefresh: jest.fn(),
      signAccess: jest.fn(),
      signRefresh: jest.fn(),
      register: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: serviceMock },
        { provide: MailService, useValue: mailServiceMock },
      ],
    }).compile();

    controller = module.get(AuthController);
    service = module.get(AuthService) as any;

    jest.clearAllMocks();
  });

  const makeRes = () => {
    const cookies: Record<string, any> = {};
    return {
      cookie: jest.fn((name: string, val: string, opts: any) => {
        cookies[name] = { val, opts };
      }),
      clearCookie: jest.fn((name: string, opts: any) => {
        delete cookies[name];
      }),
      _cookies: cookies,
    } as any;
  };

  describe('POST /auth/login', () => {
    it('pose le cookie refresh + renvoie access_token', async () => {
      service.login.mockResolvedValue({ access: 'access-token', refresh: 'refresh-token' });

      const res = makeRes();
      const body = { email: 'a@a.com', password: 'secret' };

      const out = await controller.login(body, res);

      expect(service.login).toHaveBeenCalledWith('a@a.com', 'secret');
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-token',
        expect.objectContaining({
          httpOnly: true,
          path: '/api/auth',
          sameSite: 'strict',
        }),
      );
      expect(out).toEqual({ access_token: 'access-token' });
    });
  });

  describe('POST /auth/refresh', () => {
    it('renvoie access_token et rotate le refresh si cookie présent et valide', async () => {
      const req = { cookies: { refresh_token: 'old-refresh' } } as any;
      const res = makeRes();

      // Payload minimal et permissif : pas d'email, rôle potentiellement en MAJ
      service.refreshTokens.mockResolvedValue({ access: 'new-access', refresh: 'new-refresh' });

      const out = await controller.refresh(req, res);

      expect(service.refreshTokens).toHaveBeenCalledWith('old-refresh');

      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'new-refresh',
        expect.objectContaining({
          httpOnly: true,
          path: '/api/auth',
          sameSite: 'strict',
        }),
      );
      expect(out).toEqual({ access_token: 'new-access' });
    });

    it('renvoie access_token:null si pas de cookie', async () => {
      const req = { cookies: {} } as any;
      const res = makeRes();

      const out = await controller.refresh(req, res);

      expect(out).toEqual({ access_token: null });
      expect(service.refreshTokens).not.toHaveBeenCalled();
    });

    it('renvoie access_token:null si verifyRefresh jette', async () => {
      const req = { cookies: { refresh_token: 'bad' } } as any;
      const res = makeRes();

      service.refreshTokens.mockRejectedValue(new Error('invalid'));

      const out = await controller.refresh(req, res);

      expect(out).toEqual({ access_token: null });
      expect(service.signAccess).not.toHaveBeenCalled();
      expect(service.signRefresh).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/logout', () => {
    it('efface le cookie et renvoie message ok', async () => {
      const res = makeRes();

      const out = await controller.logout(res, { cookies: {} } as any);

      expect(res.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.objectContaining({ path: '/api/auth' }),
      );
      expect(out).toEqual({ message: 'ok' });
    });
  });
});
