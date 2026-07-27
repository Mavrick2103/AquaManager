import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  THROTTLER_LIMIT,
  THROTTLER_SKIP,
  THROTTLER_TTL,
} from '@nestjs/throttler/dist/throttler.constants';
import request from 'supertest';
import type { NextFunction, Request, Response } from 'express';
import {
  AiRateLimit,
  LoginRateLimit,
} from '../../src/common/throttling/rate-limit.decorator';
import { AuthController } from '../../src/auth/auth.controller';
import { ContactController } from '../../src/contact/contact.controller';
import { AiController } from '../../src/ai/ai.controller';
import { FishCardsController } from '../../src/catalog/fish-cards/fish-card.controller';
import { PlantCardsController } from '../../src/catalog/plant-cards/plant-card.controller';
import { BillingController } from '../../src/billing/billing.controller';

@Controller('rate-limit-test')
class RateLimitTestController {
  @Get('login')
  @LoginRateLimit()
  login() {
    return { ok: true };
  }

  @Get('ai/one')
  @AiRateLimit()
  aiOne() {
    return { ok: true };
  }

  @Get('ai/two')
  @AiRateLimit()
  aiTwo() {
    return { ok: true };
  }
}

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
  controllers: [RateLimitTestController],
})
class RateLimitTestModule {}

describe('Rate limiting ciblé', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RateLimitTestModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
    app.use((req: Request & { user?: { userId: number } }, _res: Response, next: NextFunction) => {
      const userId = Number(req.header('x-test-user'));
      if (Number.isFinite(userId) && userId > 0) req.user = { userId };
      next();
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('limite la connexion à 5 requêtes par IP réelle et par minute', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .get('/rate-limit-test/login')
        .set('X-Forwarded-For', '203.0.113.10')
        .expect(200);
    }

    await request(app.getHttpServer())
      .get('/rate-limit-test/login')
      .set('X-Forwarded-For', '203.0.113.10')
      .expect(429);

    await request(app.getHttpServer())
      .get('/rate-limit-test/login')
      .set('X-Forwarded-For', '203.0.113.11')
      .expect(200);
  });

  it('agrège les routes IA par utilisateur, indépendamment de son IP', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .get('/rate-limit-test/ai/one')
        .set('x-test-user', '42')
        .set('X-Forwarded-For', '203.0.113.20')
        .expect(200);
      await request(app.getHttpServer())
        .get('/rate-limit-test/ai/two')
        .set('x-test-user', '42')
        .set('X-Forwarded-For', '203.0.113.21')
        .expect(200);
    }

    await request(app.getHttpServer())
      .get('/rate-limit-test/ai/one')
      .set('x-test-user', '42')
      .expect(429);

    await request(app.getHttpServer())
      .get('/rate-limit-test/ai/one')
      .set('x-test-user', '43')
      .expect(200);
  });
});

describe('Configuration des routes AquaManager', () => {
  const expectLimit = (
    target: object,
    limit: number,
    ttl: number,
  ) => {
    expect(Reflect.getMetadata(`${THROTTLER_LIMIT}default`, target)).toBe(limit);
    expect(Reflect.getMetadata(`${THROTTLER_TTL}default`, target)).toBe(ttl);
  };

  it('applique les limites IP attendues aux routes publiques sensibles', () => {
    expectLimit(AuthController.prototype.login, 5, 60_000);
    expectLimit(AuthController.prototype.register, 5, 60 * 60_000);
    expectLimit(AuthController.prototype.forgotPassword, 3, 60 * 60_000);
    expectLimit(AuthController.prototype.resetPassword, 5, 60 * 60_000);
    expectLimit(ContactController.prototype.send, 5, 60 * 60_000);
  });

  it('applique les limites par utilisateur aux routes IA et aux uploads', () => {
    expectLimit(AiController, 10, 60_000);

    for (const handler of [
      FishCardsController.prototype.upload,
      FishCardsController.prototype.createEditor,
      FishCardsController.prototype.createAdmin,
      PlantCardsController.prototype.upload,
      PlantCardsController.prototype.createEditor,
      PlantCardsController.prototype.createAdmin,
    ]) {
      expectLimit(handler, 10, 60_000);
    }
  });

  it('exempte explicitement le webhook Stripe', () => {
    expect(
      Reflect.getMetadata(
        `${THROTTLER_SKIP}default`,
        BillingController.prototype.webhook,
      ),
    ).toBe(true);
  });
});
