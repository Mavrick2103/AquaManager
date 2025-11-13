import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const serviceMock: Partial<jest.Mocked<AuthService>> = {
      login: jest.fn(),
      verifyRefresh: jest.fn(),
      signAccess: jest.fn(),
      signRefresh: jest.fn(),
      register: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: serviceMock }],
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
          path: '/api/auth/refresh',
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
      service.verifyRefresh.mockResolvedValue({ sub: 1, role: 'USER' } as any);
      service.signAccess.mockResolvedValue('new-access');
      service.signRefresh.mockResolvedValue('new-refresh');

      const out = await controller.refresh(req, res);

      expect(service.verifyRefresh).toHaveBeenCalledWith('old-refresh');

      // On n'impose plus la présence d'email et on tolère USER/user
      expect(service.signAccess).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 1, role: expect.stringMatching(/^user$/i) }),
      );
      expect(service.signRefresh).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 1, role: expect.stringMatching(/^user$/i) }),
      );

      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'new-refresh',
        expect.objectContaining({
          httpOnly: true,
          path: '/api/auth/refresh',
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
      expect(service.verifyRefresh).not.toHaveBeenCalled();
    });

    it('renvoie access_token:null si verifyRefresh jette', async () => {
      const req = { cookies: { refresh_token: 'bad' } } as any;
      const res = makeRes();

      service.verifyRefresh.mockRejectedValue(new Error('invalid'));

      const out = await controller.refresh(req, res);

      expect(out).toEqual({ access_token: null });
      expect(service.signAccess).not.toHaveBeenCalled();
      expect(service.signRefresh).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/logout', () => {
    it('efface le cookie et renvoie message ok', async () => {
      const res = makeRes();

      const out = await controller.logout(res);

      expect(res.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.objectContaining({ path: '/api/auth/refresh' }),
      );
      expect(out).toEqual({ message: 'ok' });
    });
  });
});
