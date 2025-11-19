import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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

  /**
   * Vérifie que l'aquarium existe ET appartient bien à l'utilisateur.
   * Lève une erreur si ce n'est pas le cas.
   */
  private async ensureOwnership(userId: number, aquariumId: number): Promise<Aquarium> {
    const aquarium = await this.aquas.findOne({
      where: { id: aquariumId, user: { id: userId } },
      relations: ['user'],
    });
    if (!aquarium) {
      // On ne précise pas si c'est une question d'appartenance ou d'existence → meilleure sécurité
      throw new NotFoundException('Aquarium introuvable');
    }
    return aquarium;
  }

  async listForAquarium(userId: number, aquariumId: number) {
    await this.ensureOwnership(userId, aquariumId);
    return this.repo.find({
      where: { aquariumId },
      order: { measuredAt: 'DESC' },
    });
  }

  async createForAquarium(userId: number, aquariumId: number, dto: CreateWaterMeasurementDto) {
    const aquarium = await this.ensureOwnership(userId, aquariumId);

    // Nettoyage selon le type d'eau
    if (aquarium.waterType === 'EAU_DOUCE') {
      dto.dkh = dto.salinity = dto.ca = dto.mg = undefined;
    } else {
      dto.kh = dto.gh = dto.no2 = dto.no3 = dto.fe = dto.k = dto.sio2 = dto.nh3 = undefined;
    }

    const m = this.repo.create({
      aquariumId,
      measuredAt: new Date(dto.measuredAt),
      ph: dto.ph ?? null,
      temp: dto.temp ?? null,
      kh: dto.kh ?? null,
      gh: dto.gh ?? null,
      no2: dto.no2 ?? null,
      no3: dto.no3 ?? null,
      dkh: dto.dkh ?? null,
      salinity: dto.salinity ?? null,
      ca: dto.ca ?? null,
      mg: dto.mg ?? null,
      po4: dto.po4 ?? null,
      fe: dto.fe ?? null,
      k: dto.k ?? null,
      sio2: dto.sio2 ?? null,
      nh3: dto.nh3 ?? null,
      comment: dto.comment?.trim() || null,
    });

    return this.repo.save(m);
  }

  async deleteForAquarium(userId: number, aquariumId: number, id: number) {
    await this.ensureOwnership(userId, aquariumId);

    const measurement = await this.repo.findOne({ where: { id, aquariumId } });
    if (!measurement) {
      throw new NotFoundException('Mesure introuvable pour cet aquarium');
    }

    await this.repo.delete({ id });
    return { success: true };
  }
}
