import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

import { WaterMeasurementService } from '../../src/water-measurement/water-measurement.service';
import { WaterMeasurement } from '../../src/water-measurement/water-measurement.entity';
import { Aquarium } from '../../src/aquariums/aquariums.entity';
import { CreateWaterMeasurementDto } from '../../src/water-measurement/dto/create-water-measurement.dto';

import { UsersService } from '../../src/users/users.service'; // ✅ à mock
import { MailService } from '../../src/mail/mail.service';
import { mailServiceMock } from '../utils/mail.mock';

describe('WaterMeasurementService (unit)', () => {
  let service: WaterMeasurementService;
  let repo: jest.Mocked<Repository<WaterMeasurement>>;
  let aquas: jest.Mocked<Repository<Aquarium>>;
  let usersService: { touchActivity: jest.Mock };

  beforeEach(async () => {
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

    const usersServiceMock = {
      touchActivity: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaterMeasurementService,
        { provide: getRepositoryToken(WaterMeasurement), useValue: waterRepoMock },
        { provide: getRepositoryToken(Aquarium), useValue: aquariumRepoMock },

        // ✅ LA LIGNE QUI MANQUAIT
        { provide: UsersService, useValue: usersServiceMock },

        { provide: MailService, useValue: mailServiceMock },
      ],
    }).compile();

    service = module.get(WaterMeasurementService);
    repo = module.get(getRepositoryToken(WaterMeasurement));
    aquas = module.get(getRepositoryToken(Aquarium));
    usersService = module.get(UsersService);

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
      expect(usersService.touchActivity).not.toHaveBeenCalled(); // normal: ton code ne le fait pas ici
    });

    it('lève NotFoundException si aquarium non trouvé', async () => {
      aquas.findOne.mockResolvedValue(null as any);

      await expect(service.listForAquarium(1, 5)).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.find).not.toHaveBeenCalled();
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
        // champs eau de mer -> doivent finir à null
        dkh: 8,
        salinity: 35,
        ca: 400,
        mg: 1200,
        comment: '  test  ',
      } as any;

      const createdEntity = { fake: true } as any;
      const savedEntity = { id: 10, saved: true } as any;

      repo.create.mockReturnValue(createdEntity);
      repo.save.mockResolvedValue(savedEntity);

      const res = await service.createForAquarium(userId, aquariumId, dto);

      const createArg = (repo.create as jest.Mock).mock.calls[0][0];

      expect(createArg.aquariumId).toBe(aquariumId);
      expect(createArg.measuredAt).toBeInstanceOf(Date);

      expect(createArg.kh).toBe(4);
      expect(createArg.gh).toBe(6);

      // nettoyés (EAU_DOUCE)
      expect(createArg.dkh).toBeNull();
      expect(createArg.salinity).toBeNull();
      expect(createArg.ca).toBeNull();
      expect(createArg.mg).toBeNull();

      expect(createArg.comment).toBe('test');

      expect(repo.save).toHaveBeenCalledWith(createdEntity);
      expect(usersService.touchActivity).toHaveBeenCalledWith(userId);
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
      repo.delete.mockResolvedValue({} as any);

      const res = await service.deleteForAquarium(userId, aquariumId, id);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id, aquariumId } });
      expect(repo.delete).toHaveBeenCalledWith({ id });
      expect(usersService.touchActivity).toHaveBeenCalledWith(userId);
      expect(res).toEqual({ success: true });
    });

    it('lève NotFoundException si la mesure est absente', async () => {
      aquas.findOne.mockResolvedValue({
        id: 3,
        waterType: 'EAU_DOUCE',
        user: { id: 1 },
      } as any);

      repo.findOne.mockResolvedValue(null as any);

      await expect(service.deleteForAquarium(1, 3, 99)).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});
