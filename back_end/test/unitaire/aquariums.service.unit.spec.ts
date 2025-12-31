import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

import { AquariumsService } from '../../src/aquariums/aquariums.service';
import { Aquarium } from '../../src/aquariums/aquariums.entity';
import { User } from '../../src/users/user.entity';
import { MailService } from '../../src/mail/mail.service';
import { mailServiceMock } from '../utils/mail.mock';

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
    };

    const usersRepoMock: Partial<jest.Mocked<Repository<User>>> = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AquariumsService,
        { provide: getRepositoryToken(Aquarium), useValue: aquariumRepoMock },
        { provide: getRepositoryToken(User), useValue: usersRepoMock },
        { provide: MailService, useValue: mailServiceMock },
      ],
    }).compile();

    service = module.get(AquariumsService);
    repo = module.get(getRepositoryToken(Aquarium));
    usersRepo = module.get(getRepositoryToken(User));
  });

  it('findMine() -> renvoie la liste des aquariums du user', async () => {
    repo.find.mockResolvedValue([{ id: 1 }, { id: 2 }] as any);
    const res = await service.findMine(1);
    expect(repo.find).toHaveBeenCalledWith({
      where: { user: { id: 1 } },
      order: { createdAt: 'DESC' },
    });
    expect(res).toHaveLength(2);
  });

  it('findOne() -> 404 si non trouvé', async () => {
    repo.findOne.mockResolvedValue(null as any);
    await expect(service.findOne(1, 123)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findOne() -> renvoie un aquarium appartenant au user', async () => {
    repo.findOne.mockResolvedValue({ id: 5, user: { id: 1 } } as any);
    const ok = await service.findOne(1, 5);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 5, user: { id: 1 } },
      relations: { user: true },
    });
    expect(ok).toEqual({ id: 5, user: { id: 1 } });
  });

  it('create() -> 404 si user inexistant', async () => {
    usersRepo.findOne.mockResolvedValue(null as any);
    await expect(
      service.create(99, {
        name: 'A',
        lengthCm: 10, widthCm: 10, heightCm: 10,
        waterType: 'EAU_DOUCE',
        startDate: '2025-01-01',
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create() -> calcule volume et sauvegarde', async () => {
    usersRepo.findOne.mockResolvedValue({ id: 1 } as any);
    repo.create.mockImplementation((x: any) => x);
    repo.save.mockImplementation(async (x: any) => ({ id: 10, ...x }));

    const res = await service.create(1, {
      name: 'Proxima 175',
      lengthCm: 70,
      widthCm: 40,
      heightCm: 50,
      waterType: 'EAU_DOUCE',
      startDate: '2025-01-01',
    } as any);

    expect(res.volumeL).toBe(140);
    expect(repo.create).toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalled();
    expect(res.id).toBeDefined();
  });

  it('update() -> 404 si non trouvé', async () => {
    repo.findOne.mockResolvedValue(null as any);
    await expect(service.update(1, 7, { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update() -> met à jour les champs et recalcule le volume si dimensions changent', async () => {
    repo.findOne.mockResolvedValue({
      id: 7,
      name: 'X',
      lengthCm: 50,
      widthCm: 30,
      heightCm: 30,
      volumeL: 45,
      waterType: 'EAU_DOUCE',
      startDate: '2025-01-01',
      user: { id: 1 },
    } as any);

    repo.save.mockImplementation(async (a: any) => a);

    const updated = await service.update(1, 7, { lengthCm: 54, widthCm: 32 });
    expect(updated.volumeL).toBe(52);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ lengthCm: 54, widthCm: 32, heightCm: 30, volumeL: 52 }),
    );
  });

  it('remove() -> supprime et renvoie {ok:true}', async () => {
    repo.findOne.mockResolvedValue({ id: 9, user: { id: 1 } } as any);
    repo.remove.mockResolvedValue({} as any);
    const res = await service.remove(1, 9);
    expect(repo.remove).toHaveBeenCalledWith({ id: 9, user: { id: 1 } });
    expect(res).toEqual({ ok: true });
  });
});
