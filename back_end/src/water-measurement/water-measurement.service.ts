import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WaterMeasurement } from './water-measurement.entity';
import { Aquarium } from '../aquariums/aquariums.entity';
import { CreateWaterMeasurementDto } from './dto/create-water-measurement.dto';

@Injectable()
export class WaterMeasurementsService {
  constructor(
    @InjectRepository(WaterMeasurement) private readonly repo: Repository<WaterMeasurement>,
    @InjectRepository(Aquarium) private readonly aquas: Repository<Aquarium>,
  ) {}

  private async ensureAquarium(userId: number, aquariumId: number): Promise<Aquarium> {
    const a = await this.aquas.findOne({ where: { id: aquariumId }, relations: { user: true } });
    if (!a) throw new NotFoundException('Aquarium introuvable');
    if (!a.user || a.user.id !== userId) throw new ForbiddenException();
    return a;
  }

  async create(userId: number, aquariumId: number, dto: CreateWaterMeasurementDto) {
    const aquarium = await this.ensureAquarium(userId, aquariumId);
    const m = this.repo.create({
      aquarium,
      takenAt: new Date(dto.takenAt),
      ph: dto.ph ?? null, kh: dto.kh ?? null, gh: dto.gh ?? null, co2: dto.co2 ?? null,
      k: dto.k ?? null, no2: dto.no2 ?? null, no3: dto.no3 ?? null, amn: dto.amn ?? null,
      fe: dto.fe ?? null, temp: dto.temp ?? null, po4: dto.po4 ?? null,
    });
    return this.repo.save(m);
  }

  async list(userId: number, aquariumId: number, limit = 200) {
    await this.ensureAquarium(userId, aquariumId);
    return this.repo.find({
      where: { aquarium: { id: aquariumId } },
      order: { takenAt: 'ASC' },
      take: limit,
    });
  }
}
