import { Test, TestingModule } from '@nestjs/testing';
import { WaterMeasurementController } from '../../src/water-measurement/water-measurement.controller';
import { WaterMeasurementService } from '../../src/water-measurement/water-measurement.service';
import { CreateWaterMeasurementDto } from '../../src/water-measurement/dto/create-water-measurement.dto';
import { MailService } from '../../src/mail/mail.service';
import { mailServiceMock } from '../utils/mail.mock';

describe('WaterMeasurementController (unit)', () => {
  let controller: WaterMeasurementController;
  let service: jest.Mocked<WaterMeasurementService>;

  const mockService: Partial<jest.Mocked<WaterMeasurementService>> = {
    listForAquarium: jest.fn(),
    createForAquarium: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WaterMeasurementController],
      providers: [{ provide: WaterMeasurementService, useValue: mockService },
        { provide: MailService, useValue: mailServiceMock },
      ],
    }).compile();

    controller = module.get(WaterMeasurementController);
    service = module.get(WaterMeasurementService) as any;

    jest.clearAllMocks();
  });

  it('GET /aquariums/:aquariumId/measurements -> list()', async () => {
    const req: any = { user: { userId: 42 } };

    service.listForAquarium.mockResolvedValue([{ id: 1 }] as any);

    const res = await controller.list(req, 5);

    expect(service.listForAquarium).toHaveBeenCalledWith(42, 5);
    expect(res).toEqual([{ id: 1 }]);
  });

  it('POST /aquariums/:aquariumId/measurements -> create()', async () => {
    const req: any = { user: { userId: 42 } };

    const dto: CreateWaterMeasurementDto = {
      measuredAt: '2025-01-01T00:00:00.000Z',
    } as any;

    (service.createForAquarium as jest.Mock).mockResolvedValue({ id: 10 } as any);

    const res = await controller.create(req, 7, dto);

    expect(service.createForAquarium).toHaveBeenCalledWith(42, 7, dto);
    expect(res).toEqual({ id: 10 });
  });
});
