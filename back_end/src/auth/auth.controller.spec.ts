import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController (unit)', () => {
  let controller: AuthController;
  let service: jest.Mocked<AuthService>;

  const serviceMock: Partial<jest.Mocked<AuthService>> = {
    login: jest.fn(),
    register: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: serviceMock }],
    }).compile();

    controller = module.get(AuthController);
    service = module.get(AuthService) as any;
    jest.clearAllMocks();
  });

  it('POST /auth/login -> délègue au service', async () => {
    service.login.mockResolvedValue({ access_token: 't' });
    const res = await controller.login({ email: 'a@a.com', password: 'x' });
    expect(service.login).toHaveBeenCalledWith('a@a.com', 'x');
    expect(res).toEqual({ access_token: 't' });
  });

  it('POST /auth/register -> délègue au service', async () => {
    service.register.mockResolvedValue({ id: 1, fullName: 'John', email: 'a@a.com' } as any);
    const res = await controller.register({ fullName: 'John', email: 'a@a.com', password: 'x' } as any);
    expect(service.register).toHaveBeenCalled();
    expect(res).toEqual({ id: 1, fullName: 'John', email: 'a@a.com' });
  });
});
