import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

import { AquariumsController } from '../../src/aquariums/aquariums.controller';
import { AquariumsService } from '../../src/aquariums/aquariums.service';
import { Aquarium } from '../../src/aquariums/aquariums.entity';
import { User } from '../../src/users/user.entity';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';

describe('Aquariums (tests fonctionnels)', () => {
  let controller: AquariumsController;
  let service: AquariumsService;
  let repo: jest.Mocked<Repository<Aquarium>>;
  let usersRepo: jest.Mocked<Repository<User>>;

  const req = { user: { userId: 1 } } as any;

  beforeEach(async () => {
    const aquariumRepoMock: Partial<jest.Mocked<Repository<Aquarium>>> = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const usersRepoMock: Partial<jest.Mocked<Repository<User>>> = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AquariumsController],
      providers: [
        AquariumsService,
        { provide: getRepositoryToken(Aquarium), useValue: aquariumRepoMock },
        { provide: getRepositoryToken(User), useValue: usersRepoMock },
        { provide: JwtAuthGuard, useValue: { canActivate: () => true } },
      ],
    }).compile();

    controller = module.get(AquariumsController);
    service = module.get(AquariumsService);
    repo = module.get(getRepositoryToken(Aquarium));
    usersRepo = module.get(getRepositoryToken(User));

    jest.clearAllMocks();
  });

  it('scénario fonctionnel : un user crée un aquarium puis récupère sa liste', async () => {

    usersRepo.findOne.mockResolvedValue({ id: 1 } as any);

    repo.create.mockImplementation((partial: any) => partial as any);
    repo.save.mockImplementation(async (a: any) => ({ id: 42, ...a }));

    const dto = {
      name: ' Proxima 175 ',
      lengthCm: 70,
      widthCm: 40,
      heightCm: 50,
      waterType: 'EAU_DOUCE' as const,
      startDate: '2025-01-01',
    };

    const created = await controller.create(req, dto as any);

    expect(usersRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Proxima 175',
        lengthCm: 70,
        widthCm: 40,
        heightCm: 50,
        volumeL: 140,
        waterType: 'EAU_DOUCE',
        user: { id: 1 },
      }),
    );
    expect(created).toMatchObject({
      id: 42,
      name: 'Proxima 175',
      volumeL: 140,
    });

    repo.find.mockResolvedValue([created]);
    const mine = await controller.findMine(req);

    expect(repo.find).toHaveBeenCalledWith({
      where: { user: { id: 1 } },
      order: { createdAt: 'DESC' },
    });
    expect(mine).toHaveLength(1);
    expect(mine[0].id).toBe(42);
  });

  it('création échoue si le user n’existe pas', async () => {
    usersRepo.findOne.mockResolvedValue(null as any);

    await expect(
      controller.create(req, {
        name: 'A',
        lengthCm: 10,
        widthCm: 10,
        heightCm: 10,
        waterType: 'EAU_DOUCE',
        startDate: '2025-01-01',
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('findMine retourne bien les aquariums du user triés par date', async () => {
    const list = [
      { id: 2, createdAt: new Date('2025-01-02') },
      { id: 1, createdAt: new Date('2025-01-01') },
    ];
    repo.find.mockResolvedValue(list as any);

    const res = await controller.findMine(req);

    expect(repo.find).toHaveBeenCalledWith({
      where: { user: { id: 1 } },
      order: { createdAt: 'DESC' },
    });
    expect(res).toEqual(list);
  });

  it('findOne retourne un aquarium appartenant au user', async () => {
    const aquarium = {
      id: 7,
      name: 'Mon bac',
      user: { id: 1 },
    };
    repo.findOne.mockResolvedValue(aquarium as any);

    const res = await controller.findOne(req, 7);

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 7, user: { id: 1 } },
      relations: { user: true },
    });
    expect(res).toEqual(aquarium);
  });

  it('findOne lève une NotFoundException si l’aquarium est introuvable', async () => {
    repo.findOne.mockResolvedValue(null as any);

    await expect(controller.findOne(req, 999)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update recalcule le volume si les dimensions changent', async () => {
    // aquarium initial
    repo.findOne.mockResolvedValue({
      id: 7,
      name: 'Ancien',
      lengthCm: 50,
      widthCm: 30,
      heightCm: 30,
      volumeL: 45,
      waterType: 'EAU_DOUCE',
      startDate: new Date('2025-01-01'),
      user: { id: 1 },
    } as any);

    repo.save.mockImplementation(async (a: any) => a);

    const updated = await controller.update(req, 7, {
      lengthCm: 60,
      widthCm: 35,
    } as any);

    // nouveau volume = 60*35*30 / 1000 = 63
    expect(updated.volumeL).toBe(63);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 7,
        lengthCm: 60,
        widthCm: 35,
        heightCm: 30,
        volumeL: 63,
      }),
    );
  });

  it('remove supprime l’aquarium du user et renvoie { ok: true }', async () => {
    const aquarium = {
      id: 9,
      name: 'A supprimer',
      user: { id: 1 },
    };
    repo.findOne.mockResolvedValue(aquarium as any);
    repo.remove.mockResolvedValue({} as any);

    const res = await controller.remove(req, 9);

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 9, user: { id: 1 } },
      relations: { user: true },
    });
    expect(repo.remove).toHaveBeenCalledWith(aquarium);
    expect(res).toEqual({ ok: true });
  });
});
