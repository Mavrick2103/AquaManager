import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WaterMeasurementService } from '../../src/water-measurement/water-measurement.service';
import { WaterMeasurement } from '../../src/water-measurement/water-measurement.entity';
import { Aquarium } from '../../src/aquariums/aquariums.entity';
import { CreateWaterMeasurementDto } from '../../src/water-measurement/dto/create-water-measurement.dto';
import { NotFoundException } from '@nestjs/common';
import { MailService } from '../../src/mail/mail.service';
import { mailServiceMock } from '../utils/mail.mock';

describe('WaterMeasurementService (unit)', () => {
  let service: WaterMeasurementService;
  let repo: jest.Mocked<Repository<WaterMeasurement>>;
  let aquas: jest.Mocked<Repository<Aquarium>>;

  const waterRepoMock: Partial<jest.Mocked<Repository<WaterMeasurement>>> = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
  };

  const aquariumRepoMock: Partial<jest.Mocked<Repository<Aquarium>>> = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaterMeasurementService,
        {
          provide: getRepositoryToken(WaterMeasurement),
          useValue: waterRepoMock,
        },
        {
          provide: getRepositoryToken(Aquarium),
          useValue: aquariumRepoMock,
        },
        { provide: MailService, useValue: mailServiceMock },
      ],
    }).compile();

    service = module.get(WaterMeasurementService);
    repo = module.get(getRepositoryToken(WaterMeasurement));
    aquas = module.get(getRepositoryToken(Aquarium));

    jest.clearAllMocks();
  });

  describe('listForAquarium', () => {
    it('retourne la liste si aquarium existe', async () => {
      const userId = 1;
      const aquariumId = 5;

      aquas.findOne.mockResolvedValue({
        id: aquariumId,
        waterType: 'EAU_DOUCE',
        user: { id: userId },
      } as any);

      const measurements = [{ id: 1 }, { id: 2 }] as any;
      repo.find.mockResolvedValue(measurements);

      const res = await service.listForAquarium(userId, aquariumId);

      expect(aquas.findOne).toHaveBeenCalledWith({
        where: { id: aquariumId, user: { id: userId } },
        relations: ['user'],
      });
      expect(repo.find).toHaveBeenCalledWith({
        where: { aquariumId },
        order: { measuredAt: 'DESC' },
      });
      expect(res).toBe(measurements);
    });

    it('lève NotFoundException si aquarium non trouvé', async () => {
      const userId = 1;
      const aquariumId = 5;

      aquas.findOne.mockResolvedValue(null);

      await expect(
        service.listForAquarium(userId, aquariumId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('createForAquarium', () => {
    it('crée et sauvegarde une mesure (eau douce) et nettoie les champs inadaptés', async () => {
      const userId = 1;
      const aquariumId = 7;

      aquas.findOne.mockResolvedValue({
        id: aquariumId,
        waterType: 'EAU_DOUCE',
        user: { id: userId },
      } as any);

      const dto: CreateWaterMeasurementDto = {
        measuredAt: '2025-01-01T00:00:00.000Z',
        ph: 7.2,
        temp: 24,
        kh: 4,
        gh: 6,
        no2: 0,
        no3: 5,
        po4: 0.5,
        fe: 0.1,
        k: 10,
        sio2: 1,
        nh3: 0,
        // champs eau de mer qui doivent être nettoyés
        dkh: 8,
        salinity: 35,
        ca: 400,
        mg: 1200,
        comment: '  test  ',
      } as any;

      const createdEntity = { id: 10 } as any;
      const savedEntity = { id: 10, saved: true } as any;

      (repo.create as jest.Mock).mockReturnValue(createdEntity);
      (repo.save as jest.Mock).mockResolvedValue(savedEntity);

      const res = await service.createForAquarium(userId, aquariumId, dto);

      expect(aquas.findOne).toHaveBeenCalled();
      expect(repo.create).toHaveBeenCalledTimes(1);

      const createArg = (repo.create as jest.Mock).mock.calls[0][0];

      // On vérifie que:
      expect(createArg.aquariumId).toBe(aquariumId);
      expect(createArg.measuredAt).toBeInstanceOf(Date);
      // champs eau douce présents
      expect(createArg.kh).toBe(4);
      expect(createArg.gh).toBe(6);
      // champs eau de mer nettoyés
      expect(createArg.dkh).toBeNull();
      expect(createArg.salinity).toBeNull();
      expect(createArg.ca).toBeNull();
      expect(createArg.mg).toBeNull();
      // comment trim
      expect(createArg.comment).toBe('test');

      expect(repo.save).toHaveBeenCalledWith(createdEntity);
      expect(res).toBe(savedEntity);
    });
  });

  describe('deleteForAquarium', () => {
    it('supprime une mesure existante', async () => {
      const userId = 1;
      const aquariumId = 3;
      const id = 99;

      aquas.findOne.mockResolvedValue({
        id: aquariumId,
        waterType: 'EAU_DOUCE',
        user: { id: userId },
      } as any);

      repo.findOne.mockResolvedValue({ id, aquariumId } as any);

      const res = await service.deleteForAquarium(userId, aquariumId, id);

      expect(aquas.findOne).toHaveBeenCalled();
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id, aquariumId } });
      expect(repo.delete).toHaveBeenCalledWith({ id });
      expect(res).toEqual({ success: true });
    });

    it('lève NotFoundException si la mesure est absente', async () => {
      const userId = 1;
      const aquariumId = 3;
      const id = 99;

      aquas.findOne.mockResolvedValue({
        id: aquariumId,
        waterType: 'EAU_DOUCE',
        user: { id: userId },
      } as any);

      repo.findOne.mockResolvedValue(null);

      await expect(
        service.deleteForAquarium(userId, aquariumId, id),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
