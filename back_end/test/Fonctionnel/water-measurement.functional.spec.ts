import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

import { WaterMeasurementController } from '../../src/water-measurement/water-measurement.controller';
import { WaterMeasurementService } from '../../src/water-measurement/water-measurement.service';
import { WaterMeasurement } from '../../src/water-measurement/water-measurement.entity';
import { Aquarium } from '../../src/aquariums/aquariums.entity';
import { MailService } from '../../src/mail/mail.service';
import { mailServiceMock } from '../utils/mail.mock';

describe('WaterMeasurement (tests fonctionnels)', () => {
  let controller: WaterMeasurementController;
  let service: WaterMeasurementService;
  let repo: jest.Mocked<Repository<WaterMeasurement>>;
  let aquasRepo: jest.Mocked<Repository<Aquarium>>;

  const req = { user: { userId: 1 } } as any;

  beforeEach(async () => {
    const measurementRepoMock: Partial<jest.Mocked<Repository<WaterMeasurement>>> = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const aquasRepoMock: Partial<jest.Mocked<Repository<Aquarium>>> = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WaterMeasurementController],
      providers: [
        WaterMeasurementService,
        { provide: getRepositoryToken(WaterMeasurement), useValue: measurementRepoMock },
        { provide: getRepositoryToken(Aquarium), useValue: aquasRepoMock },
        { provide: MailService, useValue: mailServiceMock },
      ],
    }).compile();

    controller = module.get(WaterMeasurementController);
    service = module.get(WaterMeasurementService);
    repo = module.get(getRepositoryToken(WaterMeasurement));
    aquasRepo = module.get(getRepositoryToken(Aquarium));

    jest.clearAllMocks();
  });

  it('list() -> renvoie les mesures triées par date pour un aquarium existant', async () => {
    aquasRepo.findOne.mockResolvedValue({
      id: 1,
      waterType: 'EAU_DOUCE',
      user: { id: 1 },
    } as any);

    const list = [
      { id: 2, aquariumId: 1, measuredAt: new Date('2025-01-02') },
      { id: 1, aquariumId: 1, measuredAt: new Date('2025-01-01') },
    ];
    repo.find.mockResolvedValue(list as any);

    const res = await controller.list(req, 1);

    expect(aquasRepo.findOne).toHaveBeenCalledWith({
      where: { id: 1, user: { id: 1 } },
      relations: ['user'],
    });
    expect(repo.find).toHaveBeenCalledWith({
      where: { aquariumId: 1 },
      order: { measuredAt: 'DESC' },
    });
    expect(res).toEqual(list);
  });

  it('list() -> 404 si aquarium inexistant', async () => {
    aquasRepo.findOne.mockResolvedValue(null as any);

    await expect(controller.list(req, 999)).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('create() eau douce -> garde les paramètres eau douce et nettoie ceux eau de mer', async () => {
    aquasRepo.findOne.mockResolvedValue({
      id: 1,
      waterType: 'EAU_DOUCE',
      user: { id: 1 },
    } as any);

    repo.create.mockImplementation((partial: any) => partial as any);
    repo.save.mockImplementation(async (m: any) => ({ id: 10, ...m }));

    const dto = {
      measuredAt: '2025-01-10T10:00:00.000Z',
      ph: 6.8,
      temp: 24,
      kh: 4,
      gh: 7,
      no2: 0.1,
      no3: 10,
      fe: 0.2,
      k: 15,
      sio2: 1,
      nh3: 0,
      // champs eau de mer qu’on veut voir annulés
      dkh: 8,
      salinity: 35,
      ca: 420,
      mg: 1300,
      po4: 0.1,
      comment: '  mesure du matin  ',
    };

    const res = await controller.create(req, 1, dto as any);

    expect(aquasRepo.findOne).toHaveBeenCalledWith({
      where: { id: 1, user: { id: 1 } },
      relations: ['user'],
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        aquariumId: 1,
        measuredAt: new Date('2025-01-10T10:00:00.000Z'),
        ph: 6.8,
        temp: 24,
        kh: 4,
        gh: 7,
        no2: 0.1,
        no3: 10,
        fe: 0.2,
        k: 15,
        sio2: 1,
        nh3: 0,
        // eau de mer doit être null
        dkh: null,
        salinity: null,
        ca: null,
        mg: null,
        po4: 0.1, // tu ne la nettoies pas en eau douce dans ton service
        comment: 'mesure du matin',
      }),
    );
    expect(res).toMatchObject({
      id: 10,
      aquariumId: 1,
    });
  });

  it('create() eau de mer -> garde les paramètres eau de mer et nettoie ceux eau douce', async () => {
    aquasRepo.findOne.mockResolvedValue({
      id: 2,
      waterType: 'EAU_DE_MER',
      user: { id: 1 },
    } as any);

    repo.create.mockImplementation((partial: any) => partial as any);
    repo.save.mockImplementation(async (m: any) => ({ id: 11, ...m }));

    const dto = {
      measuredAt: '2025-02-01T12:00:00.000Z',
      ph: 8.1,
      temp: 25,
      // champs eau douce à nettoyer
      kh: 5,
      gh: 8,
      no2: 0.2,
      no3: 20,
      fe: 0.3,
      k: 10,
      sio2: 0.5,
      nh3: 0.1,
      // eau de mer
      dkh: 9,
      salinity: 34,
      ca: 430,
      mg: 1350,
      po4: 0.05,
      comment: '  récifal  ',
    };

    const res = await controller.create(req, 2, dto as any);

    expect(aquasRepo.findOne).toHaveBeenCalledWith({
      where: { id: 2, user: { id: 1 } },
      relations: ['user'],
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        aquariumId: 2,
        measuredAt: new Date('2025-02-01T12:00:00.000Z'),
        ph: 8.1,
        temp: 25,
        // eau douce nettoyée
        kh: null,
        gh: null,
        no2: null,
        no3: null,
        fe: null,
        k: null,
        sio2: null,
        nh3: null,
        // eau de mer conservée
        dkh: 9,
        salinity: 34,
        ca: 430,
        mg: 1350,
        po4: 0.05,
        comment: 'récifal',
      }),
    );
    expect(res).toMatchObject({
      id: 11,
      aquariumId: 2,
    });
  });

  it('create() -> 404 si aquarium inexistant', async () => {
    aquasRepo.findOne.mockResolvedValue(null as any);

    await expect(
      controller.create(req, 999, {
        measuredAt: '2025-01-01T00:00:00.000Z',
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('deleteForAquarium supprime une mesure existante et renvoie { success: true }', async () => {
    aquasRepo.findOne.mockResolvedValue({
      id: 1,
      user: { id: 1 },
      waterType: 'EAU_DOUCE',
    } as any);

    const measurement = {
      id: 5,
      aquariumId: 1,
    };

    repo.findOne.mockResolvedValue(measurement as any);
    repo.delete.mockResolvedValue({} as any);

    const res = await controller.remove(req, 1, 5);

    expect(aquasRepo.findOne).toHaveBeenCalledWith({
      where: { id: 1, user: { id: 1 } },
      relations: ['user'],
    });
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 5, aquariumId: 1 },
    });
    expect(repo.delete).toHaveBeenCalledWith({ id: 5 });
    expect(res).toEqual({ success: true });
  });

  it('deleteForAquarium -> 404 si la mesure n’existe pas pour cet aquarium', async () => {
    aquasRepo.findOne.mockResolvedValue({
      id: 1,
      user: { id: 1 },
      waterType: 'EAU_DOUCE',
    } as any);

    repo.findOne.mockResolvedValue(null as any);

    await expect(controller.remove(req, 1, 999)).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
