import { Test } from '@nestjs/testing';
import { ValidationPipe, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import {
  SatisfactionController,
  AdminSatisfactionController,
} from '../../src/satisfaction/satisfaction.module';
import { SatisfactionService } from '../../src/satisfaction/satisfaction.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
describe('Satisfaction HTTP permissions and validation', () => {
  let app: any;
  const service = {
    list: jest.fn(() => ({ items: [] })),
    submit: jest.fn(() => ({ ok: true })),
    review: jest.fn(() => ({ ok: true })),
    status: jest.fn(() => ({})),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SatisfactionController, AdminSatisfactionController],
      providers: [{ provide: SatisfactionService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context) {
          const req = context.switchToHttp().getRequest();
          const role = req.headers['x-test-role'];
          if (!role) throw new UnauthorizedException();
          req.user = { userId: 7, role };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterAll(() => app.close());
  it('requires authentication', () =>
    request(app.getHttpServer()).get('/satisfaction').expect(401));
  it.each(['USER', 'EDITOR'])(
    'denies %s access to admin reads and updates',
    async (role) => {
      await request(app.getHttpServer())
        .get('/admin/satisfaction')
        .set('x-test-role', role)
        .expect(403);
      await request(app.getHttpServer())
        .patch('/admin/satisfaction/1')
        .set('x-test-role', role)
        .send({ status: 'READ' })
        .expect(403);
    },
  );
  it('allows admins and validates review status', async () => {
    await request(app.getHttpServer())
      .get('/admin/satisfaction')
      .set('x-test-role', 'ADMIN')
      .expect(200);
    await request(app.getHttpServer())
      .patch('/admin/satisfaction/1')
      .set('x-test-role', 'ADMIN')
      .send({ status: 'INVALID' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/admin/satisfaction/1')
      .set('x-test-role', 'ADMIN')
      .send({ status: 'READ' })
      .expect(200);
  });
  it('rejects forged identity/plan and out-of-range ratings', async () => {
    for (const body of [
      { rating: 7 },
      { rating: 4, userId: 9 },
      { rating: 4, segment: 'PREMIUM' },
    ]) {
      await request(app.getHttpServer())
        .post('/satisfaction')
        .set('x-test-role', 'USER')
        .send(body)
        .expect(400);
    }
    await request(app.getHttpServer())
      .post('/satisfaction')
      .set('x-test-role', 'USER')
      .send({ rating: 4, comment: 'Utile' })
      .expect(201);
    expect(service.submit).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ rating: 4 }),
    );
  });
});
