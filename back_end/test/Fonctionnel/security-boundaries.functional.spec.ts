import 'reflect-metadata';
import { Controller, Get, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntitySchema } from 'typeorm';
import * as argon2 from 'argon2';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';
import { AuthSession } from '../../src/auth/auth-session.entity';
import { AuthSessionService } from '../../src/auth/auth-session.service';
import { JwtStrategy } from '../../src/auth/jwt.strategy';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/auth/guards/roles.guard';
import { Roles } from '../../src/auth/decorators/roles.decorator';
import { UsersService } from '../../src/users/users.service';
import { User } from '../../src/users/user.entity';
import { MailService } from '../../src/mail/mail.service';
import { Aquarium } from '../../src/aquariums/aquariums.entity';
import { AquariumsController } from '../../src/aquariums/aquariums.controller';
import { AquariumsService } from '../../src/aquariums/aquariums.service';
import { AquariumItemsController } from '../../src/catalog/aquarium-card-pivot/aquarium-items.controller';
import { AquariumFishCard } from '../../src/catalog/aquarium-card-pivot/aquarium-fish-card.entity';
import { AquariumPlantCard } from '../../src/catalog/aquarium-card-pivot/aquarium-plant-card.entity';

@Controller('security-test')
class ProtectedController {
  @Get() read() { return { ok: true }; }
  @Get('admin') @Roles('ADMIN') admin() { return { ok: true }; }
}

// SQLite exercises real session storage and conditional rotation. The smaller
// user schema avoids MySQL-only enum columns unrelated to these HTTP boundaries.
const testUserSchema = new EntitySchema<User>({
  name: 'User', target: User, tableName: 'users',
  columns: {
    id: { type: Number, primary: true }, email: { type: String },
    password: { type: String }, role: { type: String }, fullName: { type: String },
    authVersion: { type: Number, default: 0 }, emailVerifiedAt: { type: Date, nullable: true },
  },
});

const testSessionSchema = new EntitySchema<AuthSession>({
  name: 'AuthSession', target: AuthSession, tableName: 'auth_sessions',
  columns: {
    id: { type: String, primary: true }, userId: { type: Number },
    refreshHash: { type: String }, expiresAt: { type: Date },
  },
  relations: { user: { type: 'many-to-one', target: 'User', joinColumn: { name: 'userId' }, onDelete: 'CASCADE' } },
});

describe('Security HTTP boundaries', () => {
  let app: INestApplication;
  let db: DataSource;
  let jwt: JwtService;
  let access: string;
  let refresh: string;
  const items = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((value) => value), save: jest.fn(async (value) => value), delete: jest.fn() };
  const aquariumService = { update: jest.fn(async (_user, _id, dto) => dto) };

  beforeEach(async () => {
    jest.clearAllMocks();
    db = await new DataSource({ type: 'sqlite', database: ':memory:', synchronize: true,
      entities: [testUserSchema, testSessionSchema] }).initialize();
    await db.getRepository(User).save({ id: 1, email: 'audit@example.com', fullName: 'Audit',
      password: await argon2.hash('secure-test-password'), role: 'ADMIN', authVersion: 0, emailVerifiedAt: new Date() });
    const users = { findById: (id: number) => db.getRepository(User).findOneBy({ id }),
      findByEmailWithPassword: (email: string) => db.getRepository(User).findOneBy({ email }) };
    const config = { get: (key: string) => ({ JWT_SECRET: 'local-security-test-secret-only', JWT_EXPIRES: '15m', JWT_REFRESH_EXPIRES: '15d' })[key] };
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: config.get('JWT_SECRET') }), ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
      controllers: [AuthController, ProtectedController, AquariumItemsController, AquariumsController],
      providers: [AuthService, AuthSessionService, JwtStrategy,
        { provide: APP_GUARD, useClass: JwtAuthGuard }, { provide: APP_GUARD, useClass: RolesGuard },
        { provide: ConfigService, useValue: config }, { provide: UsersService, useValue: users },
        { provide: MailService, useValue: {} },
        { provide: getRepositoryToken(AuthSession), useValue: db.getRepository(AuthSession) },
        { provide: getRepositoryToken(Aquarium), useValue: { existsBy: jest.fn(async (where) => where.id === 10 && where.user.id === 1) } },
        { provide: getRepositoryToken(AquariumFishCard), useValue: items },
        { provide: getRepositoryToken(AquariumPlantCard), useValue: items },
        { provide: AquariumsService, useValue: aquariumService },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true,
      transformOptions: { enableImplicitConversion: true } }));
    await app.init();
    jwt = module.get(JwtService);
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'audit@example.com', password: 'secure-test-password' }).expect(201);
    access = login.body.access_token;
    refresh = extractRefresh(login);
  });

  afterEach(async () => { await app?.close(); await db?.destroy(); });

  function extractRefresh(response: any) {
    const cookie = response.headers['set-cookie'].find((value: string) => value.startsWith('refresh_token=') && !value.startsWith('refresh_token=;'));
    return cookie.split(';')[0].slice('refresh_token='.length);
  }

  it('rejects swapped token types and legacy tokens', async () => {
    await request(app.getHttpServer()).get('/api/security-test').auth(refresh, { type: 'bearer' }).expect(401);
    const result = await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', `refresh_token=${access}`).expect(201);
    expect(result.body.access_token).toBeNull();
    const legacy = await jwt.signAsync({ sub: 1, role: 'ADMIN' });
    await request(app.getHttpServer()).get('/api/security-test').auth(legacy, { type: 'bearer' }).expect(401);
  });

  it('stores only a hash and consumes each refresh once, including concurrent requests', async () => {
    expect((await db.getRepository(AuthSession).find())[0].refreshHash).not.toBe(refresh);
    const responses = await Promise.all([1, 2].map(() => request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', `refresh_token=${refresh}`)));
    expect(responses.filter((response) => response.body.access_token)).toHaveLength(1);
    const renewed = extractRefresh(responses.find((response) => response.body.access_token));
    const next = await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', `refresh_token=${renewed}`);
    expect(next.body.access_token).toBeTruthy();
  });

  it('revokes access and refresh on logout', async () => {
    await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', `refresh_token=${refresh}`).expect(201);
    await request(app.getHttpServer()).get('/api/security-test').auth(access, { type: 'bearer' }).expect(401);
    const result = await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', `refresh_token=${refresh}`);
    expect(result.body.access_token).toBeNull();
  });

  it('uses the current role for existing access tokens and refreshed tokens', async () => {
    await db.getRepository(User).update(1, { role: 'USER' });
    await request(app.getHttpServer()).get('/api/security-test/admin').auth(access, { type: 'bearer' }).expect(403);
    const result = await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', `refresh_token=${refresh}`);
    expect(jwt.decode(result.body.access_token).role).toBe('USER');
  });

  it.each(['password-version', 'deleted', 'unverified', 'expired-session'])('rejects revoked session: %s', async (reason) => {
    if (reason === 'password-version') await db.getRepository(User).update(1, { authVersion: 1 });
    if (reason === 'deleted') await db.getRepository(User).delete(1);
    if (reason === 'unverified') await db.getRepository(User).update(1, { emailVerifiedAt: null });
    if (reason === 'expired-session') await db.getRepository(AuthSession).createQueryBuilder().update().set({ expiresAt: new Date(0) }).execute();
    await request(app.getHttpServer()).get('/api/security-test').auth(access, { type: 'bearer' }).expect(401);
    const result = await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', `refresh_token=${refresh}`);
    expect(result.body.access_token).toBeNull();
  });

  it.each(['fish', 'plants'])('isolates all %s operations by owner', async (kind) => {
    const http = app.getHttpServer();
    await request(http).get(`/api/aquariums/20/${kind}`).auth(access, { type: 'bearer' }).expect(404);
    await request(http).post(`/api/aquariums/20/${kind}`).auth(access, { type: 'bearer' }).send({ cardId: 1, count: 1 }).expect(404);
    await request(http).delete(`/api/aquariums/20/${kind}/1`).auth(access, { type: 'bearer' }).expect(404);
    expect(items.find).not.toHaveBeenCalled(); expect(items.save).not.toHaveBeenCalled(); expect(items.delete).not.toHaveBeenCalled();
    await request(http).get(`/api/aquariums/10/${kind}`).auth(access, { type: 'bearer' }).expect(200);
    await request(http).post(`/api/aquariums/10/${kind}`).auth(access, { type: 'bearer' }).send({ cardId: 1, count: 1 }).expect(201);
    await request(http).delete(`/api/aquariums/10/${kind}/1`).auth(access, { type: 'bearer' }).expect(200);
  });

  it.each([{ lengthCm: -10 }, { lengthCm: null }, { unexpected: true }, { startDate: 'invalid' }])('rejects invalid aquarium updates %j', async (body) => {
    await request(app.getHttpServer()).put('/api/aquariums/10').auth(access, { type: 'bearer' }).send(body).expect(400);
    expect(aquariumService.update).not.toHaveBeenCalled();
  });

  it('accepts a valid partial aquarium update', async () => {
    await request(app.getHttpServer()).put('/api/aquariums/10').auth(access, { type: 'bearer' }).send({ lengthCm: 50 }).expect(200);
    expect(aquariumService.update).toHaveBeenCalledWith(1, 10, expect.objectContaining({ lengthCm: 50 }));
  });
});
