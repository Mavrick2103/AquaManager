import { Test, TestingModule } from '@nestjs/testing';
import { AquariumsController } from '../../src/aquariums/aquariums.controller';
import { AquariumsService } from '../../src/aquariums/aquariums.service';

describe('AquariumsController', () => {
  let controller: AquariumsController;
  let service: jest.Mocked<AquariumsService>;

  const mockService: Partial<jest.Mocked<AquariumsService>> = {
    findMine: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const req = { user: { userId: 1 } } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AquariumsController],
      providers: [{ provide: AquariumsService, useValue: mockService }],
    }).compile();

    controller = module.get(AquariumsController);
    service = module.get(AquariumsService) as any;
    jest.clearAllMocks();
  });

  it('GET /aquariums -> findMine()', async () => {
    service.findMine.mockResolvedValue([{ id: 1 }] as any);
    const res = await controller.findMine(req);
    expect(service.findMine).toHaveBeenCalledWith(1);
    expect(res).toEqual([{ id: 1 }]);
  });

  it('GET /aquariums/:id -> findOne()', async () => {
    service.findOne.mockResolvedValue({ id: 5 } as any);
    const res = await controller.findOne(req, 5);
    expect(service.findOne).toHaveBeenCalledWith(1, 5);
    expect(res).toEqual({ id: 5 });
  });

  it('POST /aquariums -> create()', async () => {
    const dto = {
      name: 'Proxima',
      lengthCm: 70,
      widthCm: 40,
      heightCm: 50,
      waterType: 'EAU_DOUCE' as const,
      startDate: '2025-01-01',
    };
    service.create.mockResolvedValue({ id: 10, ...dto } as any);
    const res = await controller.create(req, dto as any);
    expect(service.create).toHaveBeenCalledWith(1, dto);
    expect(res).toMatchObject({ id: 10 });
  });

  it('PUT /aquariums/:id -> update()', async () => {
    service.update.mockResolvedValue({ id: 7, name: 'Nouveau' } as any);
    const res = await controller.update(req, 7, { name: 'Nouveau' } as any);
    expect(service.update).toHaveBeenCalledWith(1, 7, { name: 'Nouveau' });
    expect(res).toEqual({ id: 7, name: 'Nouveau' });
  });

  it('DELETE /aquariums/:id -> remove()', async () => {
    service.remove.mockResolvedValue({ ok: true } as any);
    const res = await controller.remove(req, 9);
    expect(service.remove).toHaveBeenCalledWith(1, 9);
    expect(res).toEqual({ ok: true });
  });
});
