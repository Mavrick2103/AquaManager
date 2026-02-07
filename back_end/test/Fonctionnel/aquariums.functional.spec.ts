import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

import { AquariumsController } from '../../src/aquariums/aquariums.controller';
import { AquariumsService } from '../../src/aquariums/aquariums.service';
import { Aquarium } from '../../src/aquariums/aquariums.entity';
import { User } from '../../src/users/user.entity';
import { UsersService } from '../../src/users/users.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { MailService } from '../../src/mail/mail.service';
import { mailServiceMock } from '../utils/mail.mock';

type RepoMock = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  remove: jest.Mock;
};

type UsersRepoMock = {
  findOne: jest.Mock;
};

type UsersServiceMock = {
  touchActivity: jest.Mock;
  findById?: jest.Mock;
};

describe('Aquariums (tests fonctionnels)', () => {
  let controller: AquariumsController;
  let repo: RepoMock;
  let usersRepo: UsersRepoMock;
  let usersService: UsersServiceMock;

  const req = { user: { userId: 1 } } as any;

  beforeEach(async () => {
    const aquariumRepoMock: RepoMock = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const usersRepoMock: UsersRepoMock = {
      findOne: jest.fn(),
    };

    const usersServiceMock: UsersServiceMock = {
      touchActivity: jest.fn().mockResolvedValue(undefined),
      // si ton UsersService a aussi findById injecté/utile ailleurs, laisse-le :
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AquariumsController],
      providers: [
        AquariumsService,
        { provide: getRepositoryToken(Aquarium), useValue: aquariumRepoMock },
        { provide: getRepositoryToken(User), useValue: usersRepoMock },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: JwtAuthGuard, useValue: { canActivate: () => true } },
        { provide: MailService, useValue: mailServiceMock },
      ],
    }).compile();

    controller = module.get(AquariumsController);

    repo = module.get(getRepositoryToken(Aquarium)) as any;
    usersRepo = module.get(getRepositoryToken(User)) as any;
    usersService = module.get(UsersService) as any;

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

    expect(usersService.touchActivity).toHaveBeenCalledWith(1);

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

    expect(usersService.touchActivity).toHaveBeenCalledWith(1);

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
    expect(usersService.touchActivity).not.toHaveBeenCalled();
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
    expect(usersService.touchActivity).toHaveBeenCalledWith(1);
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
    expect(usersService.touchActivity).toHaveBeenCalledWith(1);
    expect(res).toEqual(aquarium);
  });

  it('findOne lève une NotFoundException si l’aquarium est introuvable', async () => {
    repo.findOne.mockResolvedValue(null as any);
    await expect(controller.findOne(req, 999)).rejects.toBeInstanceOf(NotFoundException);
    // touchActivity n'est pas appelé si NotFound avant
  });

  it('update recalcule le volume si les dimensions changent', async () => {
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

    expect(usersService.touchActivity).toHaveBeenCalledWith(1);

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
    expect(usersService.touchActivity).toHaveBeenCalledWith(1);
    expect(repo.remove).toHaveBeenCalledWith(aquarium);
    expect(res).toEqual({ ok: true });
  });
});
