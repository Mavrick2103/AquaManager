import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

import { WaterMeasurementService } from '../../src/water-measurement/water-measurement.service';
import { WaterMeasurement } from '../../src/water-measurement/water-measurement.entity';
import { Aquarium } from '../../src/aquariums/aquariums.entity';

describe('WaterMeasurementService (unit)', () => {
  let service: WaterMeasurementService;
  let repo: jest.Mocked<Repository<WaterMeasurement>>;
  let aquas: jest.Mocked<Repository<Aquarium>>;

  beforeEach(async () => {
    const repoMock: Partial<jest.Mocked<Repository<WaterMeasurement>>> = {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const aquasMock: Partial<jest.Mocked<Repository<Aquarium>>> = {
      exist: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaterMeasurementService,
        { provide: getRepositoryToken(WaterMeasurement), useValue: repoMock },
        { provide: getRepositoryToken(Aquarium), useValue: aquasMock },
      ],
    }).compile();

    service = module.get(WaterMeasurementService);
    repo = module.get(getRepositoryToken(WaterMeasurement));
    aquas = module.get(getRepositoryToken(Aquarium));
  });

  describe('listForAquarium', () => {
    it('lève 404 si aquarium inexistant', async () => {
      aquas.exist.mockResolvedValue(false as any);
      await expect(service.listForAquarium(123)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('retourne la liste si aquarium existe', async () => {
      aquas.exist.mockResolvedValue(true as any);
      repo.find.mockResolvedValue([{ id: 1 }, { id: 2 }] as any);

      const res = await service.listForAquarium(5);
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { aquariumId: 5 } })
      );
      expect(res).toHaveLength(2);
    });
  });

  describe('createForAquarium', () => {
    it('lève 404 si aquarium inexistant', async () => {
      aquas.findOne.mockResolvedValue(null as any);
      await expect(
        service.createForAquarium(1, { measuredAt: '2025-01-01T10:00:00.000Z' } as any)
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('crée et sauvegarde une mesure avec défauts à null et comment trim', async () => {
      aquas.findOne.mockResolvedValue({ id: 7, waterType: 'EAU_DOUCE' } as any);
      const saved = { id: 10 } as any;
      repo.create.mockImplementation((x: any) => x);
      repo.save.mockResolvedValue(saved);

      const dto = {
        measuredAt: '2025-01-02T12:34:56.000Z',
        ph: 7.2,
        temp: 24.5,
        comment: '  test  ',
      } as any;

      const res = await service.createForAquarium(7, dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          aquariumId: 7,
          measuredAt: new Date('2025-01-02T12:34:56.000Z'),
          ph: 7.2,
          temp: 24.5,
          kh: null, gh: null, no2: null, no3: null, fe: null, k: null, sio2: null, nh3: null,
          dkh: null, salinity: null, ca: null, mg: null, po4: null,
          comment: 'test',
        })
      );

      expect(repo.save).toHaveBeenCalled();
      expect(res).toBe(saved);
    }); 
  });
});
