import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AquariumsService } from '../../src/aquariums/aquariums.service';
import { JwtService } from '@nestjs/jwt';

describe('AquariumsController (e2e) — with real JWT', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let token: string;

  const serviceMock = {
    findMine: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeAll(async () => {
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = 'testsecretvalue_min16chars';
    }

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AquariumsService)
      .useValue(serviceMock)
      .compile();

    app = moduleRef.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    jwt = moduleRef.get(JwtService);
    token = await jwt.signAsync({
      sub: 1,
      email: 'u@test',
      role: 'USER',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  it('GET /aquariums -> 200 et appelle findMine(userId)', async () => {
    serviceMock.findMine.mockResolvedValue([{ id: 1, name: 'Bac' }]);

    const res = await request(app.getHttpServer())
      .get('/aquariums')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(serviceMock.findMine).toHaveBeenCalledWith(1);
    expect(res.body).toEqual([{ id: 1, name: 'Bac' }]);
  });

  it('POST /aquariums -> 201 create(userId, dto)', async () => {
    serviceMock.create.mockResolvedValue({ id: 10, name: 'Mon Bac' });

    const body = {
      name: 'Mon Bac',
      lengthCm: 60,
      widthCm: 30,
      heightCm: 30,
      waterType: 'EAU_DOUCE' as const,
      startDate: '2025-01-01',
    };

    const res = await request(app.getHttpServer())
      .post('/aquariums')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);

    expect(serviceMock.create).toHaveBeenCalledWith(1, body);
    expect(res.body).toEqual({ id: 10, name: 'Mon Bac' });
  });

  it('POST /aquariums -> 400 si DTO invalide (ValidationPipe global)', async () => {
    await request(app.getHttpServer())
      .post('/aquariums')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Bad',
        lengthCm: 5,
        widthCm: 5,
        heightCm: 5,
        waterType: 'EAU_DOUCE',
        startDate: 'not-a-date',
      })
      .expect(400);
  });

  it('GET /aquariums/7 -> 200 findOne(userId, id)', async () => {
    serviceMock.findOne.mockResolvedValue({ id: 7, name: 'Detail' });

    const res = await request(app.getHttpServer())
      .get('/aquariums/7')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(serviceMock.findOne).toHaveBeenCalledWith(1, 7);
    expect(res.body).toEqual({ id: 7, name: 'Detail' });
  });

  it('PUT /aquariums/7 -> 200 update(userId, id, dto)', async () => {
    serviceMock.update.mockResolvedValue({ id: 7, name: 'Maj' });

    const res = await request(app.getHttpServer())
      .put('/aquariums/7')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Maj' })
      .expect(200);

    expect(serviceMock.update).toHaveBeenCalledWith(1, 7, { name: 'Maj' });
    expect(res.body).toEqual({ id: 7, name: 'Maj' });
  });

  it('DELETE /aquariums/7 -> 200 remove(userId, id)', async () => {
    serviceMock.remove.mockResolvedValue({ ok: true });

    const res = await request(app.getHttpServer())
      .delete('/aquariums/7')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(serviceMock.remove).toHaveBeenCalledWith(1, 7);
    expect(res.body).toEqual({ ok: true });
  });
});
