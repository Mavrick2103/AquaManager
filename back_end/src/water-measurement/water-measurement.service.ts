import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WaterMeasurement } from './water-measurement.entity';
import { Aquarium } from '../aquariums/aquariums.entity';
import { CreateWaterMeasurementDto } from './dto/create-water-measurement.dto';
import { UsersService } from '../users/users.service';
import { RecommendationService } from '../recommendation/recommendation.service';
import { GamificationService } from '../gamification/gamification.service';

@Injectable()
export class WaterMeasurementService {
  constructor(
    @InjectRepository(WaterMeasurement)
    private readonly repo: Repository<WaterMeasurement>,

    @InjectRepository(Aquarium)
    private readonly aquas: Repository<Aquarium>,

    private readonly usersService: UsersService,
    private readonly recoService: RecommendationService,
    private readonly gamificationService: GamificationService,
  ) {}

  // Vérification de l'appartenance de l'aquarium au user
  private async ensureOwnership(userId: number, aquariumId: number): Promise<Aquarium> {
    const aquarium = await this.aquas.findOne({
      where: { id: aquariumId, user: { id: userId } },
      relations: ['user'],
    });

    if (!aquarium) {
      throw new NotFoundException('Aquarium introuvable');
    }

    return aquarium;
  }

  // Liste des mesures
  async listForAquarium(userId: number, aquariumId: number) {
    await this.ensureOwnership(userId, aquariumId);

    return this.repo.find({
      where: { aquariumId },
      order: { measuredAt: 'DESC' },
    });
  }

  // Nouvelle mesure
  async createForAquarium(
    userId: number,
    aquariumId: number,
    dto: CreateWaterMeasurementDto,
  ) {
    const aquarium = await this.ensureOwnership(userId, aquariumId);

    // On copie le DTO pour éviter de muter l'objet reçu
    const clean: CreateWaterMeasurementDto = { ...dto };

    if (aquarium.waterType === 'EAU_DOUCE') {
      clean.dkh = undefined;
      clean.salinity = undefined;
      clean.ca = undefined;
      clean.mg = undefined;
    } else {
      clean.kh = undefined;
      clean.gh = undefined;
      clean.no2 = undefined;
      clean.no3 = undefined;
      clean.fe = undefined;
      clean.k = undefined;
      clean.sio2 = undefined;
      clean.nh3 = undefined;
    }

    const m = this.repo.create({
      aquariumId,
      measuredAt: new Date(clean.measuredAt),

      ph: clean.ph ?? null,
      temp: clean.temp ?? null,

      kh: clean.kh ?? null,
      gh: clean.gh ?? null,
      no2: clean.no2 ?? null,
      no3: clean.no3 ?? null,

      dkh: clean.dkh ?? null,
      salinity: clean.salinity ?? null,
      ca: clean.ca ?? null,
      mg: clean.mg ?? null,

      po4: clean.po4 ?? null,
      fe: clean.fe ?? null,
      k: clean.k ?? null,
      sio2: clean.sio2 ?? null,
      nh3: clean.nh3 ?? null,

      comment: clean.comment?.trim() || null,
    });

    const saved = await this.repo.save(m);

    // Activité utilisateur classique
    await this.usersService.touchActivity(userId);

    /**
     * Gamification accessible à TOUS :
     * - Classic => score de suivi, XP, streak, missions, badges
     * - Premium => score santé + analyse des objectifs
     */
    await this.gamificationService.onMeasurementCreated(userId, aquariumId);

    /**
     * Recommandations détaillées uniquement Premium.
     * C'est ici que la partie payante reste protégée.
     */
    const isPremium = await this.usersService.hasAtLeastPlan(userId, 'PREMIUM');

    const recommendations = isPremium
      ? await this.recoService.generateForMeasurement({
          userId,
          aquariumId,
          measurement: saved,
        })
      : [];

    return {
      measurement: saved,
      recommendations,
    };
  }

  // Suppression d'une mesure
  async deleteForAquarium(userId: number, aquariumId: number, id: number) {
    await this.ensureOwnership(userId, aquariumId);

    const measurement = await this.repo.findOne({
      where: { id, aquariumId },
    });

    if (!measurement) {
      throw new NotFoundException('Mesure introuvable pour cet aquarium');
    }

    await this.repo.delete({ id });

    await this.usersService.touchActivity(userId);

    return { success: true };
  }
}