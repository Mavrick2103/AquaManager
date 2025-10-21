import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

import { AquariumsService } from './aquariums.service';
import { Aquarium } from './aquariums.entity';
import { User } from '../users/user.entity';

describe('AquariumsService (unit)', () => {
  let service: AquariumsService;
  let repo: jest.Mocked<Repository<Aquarium>>;
  let usersRepo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const aquariumRepoMock: Partial<jest.Mocked<Repository<Aquarium>>> = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
    };
    const userRepoMock: Partial<jest.Mocked<Repository<User>>> = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AquariumsService,
        { provide: getRepositoryToken(Aquarium), useValue: aquariumRepoMock },
        { provide: getRepositoryToken(User), useValue: userRepoMock },
      ],
    }).compile();

    service = module.get(AquariumsService);
    repo = module.get(getRepositoryToken(Aquarium));
    usersRepo = module.get(getRepositoryToken(User));
    jest.clearAllMocks();
  });

  it('findMine() -> interroge par user.id', async () => {
    repo.find.mockResolvedValue([{ id: 1 } as any]);
    const res = await service.findMine(7);
    expect(repo.find).toHaveBeenCalledWith({ where: { user: { id: 7 } } });
    expect(res).toEqual([{ id: 1 }]);
  });

  it('create() -> 404 si user inexistant', async () => {
    usersRepo.findOne.mockResolvedValue(null);
    await expect(
      service.create(99, {
        name: 'A',
        lengthCm: 10, widthCm: 10, heightCm: 10,
        waterType: 'EAU_DOUCE',
        startDate: '2025-01-01',
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create() -> calcule volume, trim name, create + save', async () => {
    usersRepo.findOne.mockResolvedValue({ id: 1 } as any);
    // Simuler create/save TypeORM
    repo.create.mockImplementation((p: any) => p as any);
    repo.save.mockImplementation(async (a: any) => ({ id: 42, ...a }));

    const dto = {
      name: '  Mon Bac  ',
      lengthCm: 100, widthCm: 40, heightCm: 45,  // 100*40*45 / 1000 = 180 L
      waterType: 'EAU_DOUCE' as const,
      startDate: '2025-01-15',
    };

    const a = await service.create(1, dto);

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Mon Bac',
      lengthCm: 100,
      widthCm: 40,
      heightCm: 45,
      volumeL: 180,
      waterType: 'EAU_DOUCE',
      startDate: expect.any(Date),     // service convertit string -> Date
      user: { id: 1 },
    }));
    expect(repo.save).toHaveBeenCalled();
    expect(a).toEqual(expect.objectContaining({
      id: 42,
      name: 'Mon Bac',
      volumeL: 180,
    }));
  });

  it('findOne() -> renvoie le bac du user sinon 404', async () => {
    repo.findOne
      .mockResolvedValueOnce(null as any) // first call -> 404
      .mockResolvedValueOnce({ id: 5, user: { id: 1 } } as any);

    await expect(service.findOne(1, 5)).rejects.toBeInstanceOf(NotFoundException);

    const ok = await service.findOne(1, 5);
    expect(repo.findOne).toHaveBeenLastCalledWith({
      where: { id: 5, user: { id: 1 } },
      relations: { user: true },
    });
    expect(ok).toEqual({ id: 5, user: { id: 1 } });
  });

  it('update() -> recalcule volume si dimensions changent', async () => {
    // findOne est utilisé en interne
    repo.findOne.mockResolvedValue({ 
      id: 7, name: 'X', lengthCm: 50, widthCm: 30, heightCm: 30, volumeL: 45,
      waterType: 'EAU_DOUCE', startDate: new Date('2025-01-01'), user: { id: 1 }
    } as any);

    repo.save.mockImplementation(async (a: any) => a);

    const updated = await service.update(1, 7, { lengthCm: 54, widthCm: 32 }); // h=30
    // 54*32*30/1000 = 51.84 -> Math.round -> 52
    expect(updated.volumeL).toBe(52);
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
      lengthCm: 54, widthCm: 32, heightCm: 30, volumeL: 52,
    }));
  });

  it('remove() -> supprime et renvoie {ok:true}', async () => {
    repo.findOne.mockResolvedValue({ id: 9, user: { id: 1 } } as any);
    repo.remove.mockResolvedValue({} as any);
    const res = await service.remove(1, 9);
    expect(repo.remove).toHaveBeenCalledWith({ id: 9, user: { id: 1 } });
    expect(res).toEqual({ ok: true });
  });
});
