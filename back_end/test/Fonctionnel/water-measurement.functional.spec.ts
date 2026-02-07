import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { WaterMeasurementController } from '../../src/water-measurement/water-measurement.controller';
import { WaterMeasurementService } from '../../src/water-measurement/water-measurement.service';
import { MailService } from '../../src/mail/mail.service';
import { mailServiceMock } from '../utils/mail.mock';

describe('WaterMeasurement (tests fonctionnels)', () => {
  let controller: WaterMeasurementController;

  const req = { user: { userId: 1 } } as any;

  const svcMock = {
    listForAquarium: jest.fn(),
    createForAquarium: jest.fn(),
    deleteForAquarium: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WaterMeasurementController],
      providers: [
        { provide: WaterMeasurementService, useValue: svcMock },
        { provide: MailService, useValue: mailServiceMock },
      ],
    }).compile();

    controller = module.get(WaterMeasurementController);
    jest.clearAllMocks();
  });

  it('list() -> renvoie les mesures triées par date pour un aquarium existant', async () => {
    const list = [
      { id: 2, aquariumId: 1, measuredAt: new Date('2025-01-02') },
      { id: 1, aquariumId: 1, measuredAt: new Date('2025-01-01') },
    ];

    svcMock.listForAquarium.mockResolvedValue(list);

    const res = await controller.list(req, 1);

    expect(svcMock.listForAquarium).toHaveBeenCalledWith(1, 1);
    expect(res).toEqual(list);
  });

  it('list() -> 404 si aquarium inexistant', async () => {
    svcMock.listForAquarium.mockRejectedValue(new NotFoundException('Aquarium introuvable'));

    await expect(controller.list(req, 999)).rejects.toBeInstanceOf(NotFoundException);
    expect(svcMock.listForAquarium).toHaveBeenCalledWith(1, 999);
  });

  it('create() eau douce -> passe le dto au service', async () => {
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
      dkh: 8,
      salinity: 35,
      ca: 420,
      mg: 1300,
      po4: 0.1,
      comment: '  mesure du matin  ',
    };

    svcMock.createForAquarium.mockResolvedValue({
      id: 10,
      aquariumId: 1,
    });

    const res = await controller.create(req, 1, dto as any);

    expect(svcMock.createForAquarium).toHaveBeenCalledWith(1, 1, dto);
    expect(res).toMatchObject({ id: 10, aquariumId: 1 });
  });

  it('create() eau de mer -> passe le dto au service', async () => {
    const dto = {
      measuredAt: '2025-02-01T12:00:00.000Z',
      ph: 8.1,
      temp: 25,
      kh: 5,
      gh: 8,
      no2: 0.2,
      no3: 20,
      fe: 0.3,
      k: 10,
      sio2: 0.5,
      nh3: 0.1,
      dkh: 9,
      salinity: 34,
      ca: 430,
      mg: 1350,
      po4: 0.05,
      comment: '  récifal  ',
    };

    svcMock.createForAquarium.mockResolvedValue({
      id: 11,
      aquariumId: 2,
    });

    const res = await controller.create(req, 2, dto as any);

    expect(svcMock.createForAquarium).toHaveBeenCalledWith(1, 2, dto);
    expect(res).toMatchObject({ id: 11, aquariumId: 2 });
  });

  it('create() -> 404 si aquarium inexistant', async () => {
    svcMock.createForAquarium.mockRejectedValue(new NotFoundException('Aquarium introuvable'));

    await expect(
      controller.create(req, 999, { measuredAt: '2025-01-01T00:00:00.000Z' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(svcMock.createForAquarium).toHaveBeenCalledWith(1, 999, {
      measuredAt: '2025-01-01T00:00:00.000Z',
    });
  });

  it('remove() supprime une mesure existante et renvoie { success: true }', async () => {
    svcMock.deleteForAquarium.mockResolvedValue({ success: true });

    const res = await controller.remove(req, 1, 5);

    expect(svcMock.deleteForAquarium).toHaveBeenCalledWith(1, 1, 5);
    expect(res).toEqual({ success: true });
  });

  it('remove() -> 404 si la mesure n’existe pas pour cet aquarium', async () => {
    svcMock.deleteForAquarium.mockRejectedValue(new NotFoundException('Mesure introuvable'));

    await expect(controller.remove(req, 1, 999)).rejects.toBeInstanceOf(NotFoundException);
    expect(svcMock.deleteForAquarium).toHaveBeenCalledWith(1, 1, 999);
  });
});
