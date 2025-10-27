import { Test, TestingModule } from '@nestjs/testing';
import { WaterMeasurementController } from './water-measurement.controller';
import { WaterMeasurementService } from './water-measurement.service';
import { CreateWaterMeasurementDto } from './dto/create-water-measurement.dto';

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
      providers: [{ provide: WaterMeasurementService, useValue: mockService }],
    }).compile();

    controller = module.get(WaterMeasurementController);
    service = module.get(WaterMeasurementService) as any;
  });

  it('GET /aquariums/:aquariumId/measurements -> list()', async () => {
    service.listForAquarium.mockResolvedValue([{ id: 1 }] as any);
    const res = await controller.list(5);
    expect(service.listForAquarium).toHaveBeenCalledWith(5);
    expect(res).toEqual([{ id: 1 }]);
  });

  it('POST /aquariums/:aquariumId/measurements -> create()', async () => {
    const dto: CreateWaterMeasurementDto = { measuredAt: '2025-01-01T00:00:00.000Z' };
    (service.createForAquarium as jest.Mock).mockResolvedValue({ id: 10 } as any);
    const res = await controller.create(7, dto);
    expect(service.createForAquarium).toHaveBeenCalledWith(7, dto);
    expect(res).toEqual({ id: 10 });
  });
});
