import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WaterMeasurement } from './water-measurement.entity';
import { Aquarium } from '../aquariums/aquariums.entity';
import { CreateWaterMeasurementDto } from './dto/create-water-measurement.dto';

@Injectable()
export class WaterMeasurementService {
  constructor(
    @InjectRepository(WaterMeasurement) private repo: Repository<WaterMeasurement>,
    @InjectRepository(Aquarium) private aquas: Repository<Aquarium>,
  ) {}

  async listForAquarium(aquariumId: number) {
    const exists = await this.aquas.exist({ where: { id: aquariumId } });
    if (!exists) throw new NotFoundException('Aquarium introuvable');
    return this.repo.find({ where: { aquariumId }, order: { measuredAt: 'DESC' } });
  }

  async createForAquarium(aquariumId: number, dto: CreateWaterMeasurementDto) {
    const a = await this.aquas.findOne({ where: { id: aquariumId } });
    if (!a) throw new NotFoundException('Aquarium introuvable');

    // a.waterType: 'EAU_DOUCE' | 'EAU_DE_MER'
    if (a.waterType === 'EAU_DOUCE') {
      dto.dkh = dto.salinity = dto.ca = dto.mg = dto.po4 = undefined;
    } else {
      dto.kh = dto.gh = dto.no2 = undefined; // NO3 commun conservé
    }

    const m = this.repo.create({
      aquariumId,
      measuredAt: new Date(dto.measuredAt),
      ph: dto.ph ?? null, temp: dto.temp ?? null,
      kh: dto.kh ?? null, gh: dto.gh ?? null, no2: dto.no2 ?? null, no3: dto.no3 ?? null,
      dkh: dto.dkh ?? null, salinity: dto.salinity ?? null, ca: dto.ca ?? null,
      mg: dto.mg ?? null, po4: dto.po4 ?? null,
      comment: dto.comment?.trim() || null,
    });
    return this.repo.save(m);
  }
}
