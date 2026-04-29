import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Aquarium } from '../../aquariums/aquariums.entity';
import { WaterMeasurement } from '../../water-measurement/water-measurement.entity';
import { AquariumTargetsService } from '../../aquarium-targets/aquarium-targets.service';
import { UsersService } from '../../users/users.service';
import {
  AquariumHealthDetails,
  AquariumHealthScore,
  AquariumHealthStatus,
  AquariumScoreMode,
} from '../entities/aquarium-health-score.entity';

type TargetRange = { min?: number | null; max?: number | null };
type TargetMap = Record<string, TargetRange | undefined>;

const FRESH_PARAMS = ['ph', 'temp', 'no2', 'no3', 'kh', 'gh', 'po4', 'fe', 'k', 'sio2', 'nh3'] as const;
const SALT_PARAMS = ['ph', 'temp', 'dkh', 'salinity', 'ca', 'mg', 'po4', 'nh3'] as const;

@Injectable()
export class AquariumScoreService {
  constructor(
    @InjectRepository(AquariumHealthScore)
    private readonly scoreRepo: Repository<AquariumHealthScore>,
    @InjectRepository(Aquarium)
    private readonly aquariumRepo: Repository<Aquarium>,
    @InjectRepository(WaterMeasurement)
    private readonly measurementRepo: Repository<WaterMeasurement>,
    private readonly targetsService: AquariumTargetsService,
    private readonly usersService: UsersService,
  ) {}

  async recomputeForAquarium(userId: number, aquariumId: number): Promise<AquariumHealthScore> {
    const aquarium = await this.aquariumRepo.findOne({
      where: { id: aquariumId, user: { id: userId } as any },
      relations: ['user'],
    });

    if (!aquarium) {
      return this.upsertScore(userId, aquariumId, 0, 'UNKNOWN', 'TRACKING', {
        mode: 'TRACKING',
        penalties: ['Aquarium introuvable'],
      });
    }

    const latest = await this.measurementRepo.findOne({
      where: { aquariumId },
      order: { measuredAt: 'DESC' },
    });

    const isPremium = await this.usersService.hasAtLeastPlan(userId, 'PREMIUM');

    /**
     * CLASSIC :
     * Score gratuit = score de suivi uniquement.
     * Aucun diagnostic chimique, aucune plage, aucun "pH hors objectif".
     */
    if (!isPremium) {
      return this.computeFreeTrackingScore(userId, aquarium, latest);
    }

    /**
     * PREMIUM :
     * Score santé = suivi + objectifs personnalisés + paramètres hors plage.
     */
    return this.computePremiumHealthScore(userId, aquarium, latest);
  }

  async getOrCompute(userId: number, aquariumId: number): Promise<AquariumHealthScore> {
    const existing = await this.scoreRepo.findOne({ where: { userId, aquariumId } });
    if (!existing) return this.recomputeForAquarium(userId, aquariumId);

    const stale = !existing.computedAt || Date.now() - existing.computedAt.getTime() > 60 * 60 * 1000;
    return stale ? this.recomputeForAquarium(userId, aquariumId) : existing;
  }

  async recomputeAllForUser(userId: number): Promise<AquariumHealthScore[]> {
    const aquariums = await this.aquariumRepo.find({
      where: { user: { id: userId } as any },
      order: { createdAt: 'DESC' as any },
    });

    const scores: AquariumHealthScore[] = [];
    for (const aquarium of aquariums) {
      scores.push(await this.recomputeForAquarium(userId, aquarium.id));
    }
    return scores;
  }

  async computeGlobalScore(userId: number): Promise<number> {
    const scores = await this.recomputeAllForUser(userId);
    if (!scores.length) return 0;

    const sum = scores.reduce((acc, row) => acc + row.score, 0);
    return Math.round(sum / scores.length);
  }

  private async computeFreeTrackingScore(
    userId: number,
    aquarium: Aquarium,
    latest: WaterMeasurement | null,
  ): Promise<AquariumHealthScore> {
    let score = 40;

    const details: AquariumHealthDetails = {
      mode: 'TRACKING',
      bonuses: [],
      penalties: [],
      lastMeasurementAt: latest?.measuredAt?.toISOString?.() ?? null,
      tracking: {
        hasRecentMeasurement: false,
        hasHistory: false,
        aquariumCompleted: false,
      },
    };

    const hasDimensions =
      Number((aquarium as any).lengthCm) > 0 &&
      Number((aquarium as any).widthCm) > 0 &&
      Number((aquarium as any).heightCm) > 0;

    const hasWaterType = !!(aquarium as any).waterType;
    const hasStartDate = !!(aquarium as any).startDate;

    if (hasDimensions && hasWaterType && hasStartDate) {
      score += 15;
      details.tracking!.aquariumCompleted = true;
      details.bonuses?.push('Aquarium bien renseigné');
    } else {
      details.penalties?.push('Informations aquarium incomplètes');
    }

    if (!latest) {
      score -= 15;
      details.penalties?.push('Aucune mesure enregistrée');
      return this.upsertScore(userId, aquarium.id, this.clamp(score), 'UNKNOWN', 'TRACKING', details);
    }

    const ageDays = this.daysSince(new Date(latest.measuredAt));
    if (ageDays <= 7) {
      score += 25;
      details.tracking!.hasRecentMeasurement = true;
      details.bonuses?.push('Mesure récente');
    } else if (ageDays <= 14) {
      score += 10;
      details.penalties?.push('Mesure un peu ancienne');
    } else {
      score -= 15;
      details.penalties?.push('Aucune mesure récente');
    }

    const measurementCount = await this.measurementRepo.count({
      where: { aquariumId: aquarium.id },
    });

    if (measurementCount >= 3) {
      score += 15;
      details.tracking!.hasHistory = true;
      details.bonuses?.push('Historique de mesures suffisant');
    } else if (measurementCount >= 1) {
      score += 5;
      details.penalties?.push('Historique encore léger');
    }

    /**
     * Le gratuit ne regarde PAS si pH/no2/no3 sont bons ou mauvais.
     * Il récompense seulement l’habitude de suivi.
     */
    score = this.clamp(score);
    const status = this.statusFromTrackingScore(score);

    return this.upsertScore(userId, aquarium.id, score, status, 'TRACKING', details);
  }

  private async computePremiumHealthScore(
    userId: number,
    aquarium: Aquarium,
    latest: WaterMeasurement | null,
  ): Promise<AquariumHealthScore> {
    if (!latest) {
      return this.upsertScore(userId, aquarium.id, 35, 'UNKNOWN', 'HEALTH', {
        mode: 'HEALTH',
        measuredParams: 0,
        inRangeParams: 0,
        outOfRangeParams: [],
        criticalParams: [],
        bonuses: ['Aquarium créé'],
        penalties: ['Aucune mesure enregistrée'],
        lastMeasurementAt: null,
      });
    }

    const targets = await this.safeResolvePremiumTargets(aquarium.id);
    const paramKeys = aquarium.waterType === 'EAU_DE_MER' ? SALT_PARAMS : FRESH_PARAMS;

    const details: AquariumHealthDetails = {
      mode: 'HEALTH',
      measuredParams: 0,
      inRangeParams: 0,
      outOfRangeParams: [],
      criticalParams: [],
      bonuses: [],
      penalties: [],
      lastMeasurementAt: latest.measuredAt?.toISOString?.() ?? String(latest.measuredAt),
    };

    let score = 50;

    const lastMeasureAgeDays = this.daysSince(new Date(latest.measuredAt));
    if (lastMeasureAgeDays <= 7) {
      score += 15;
      details.bonuses?.push('Mesure récente');
    } else if (lastMeasureAgeDays <= 14) {
      score += 5;
      details.penalties?.push('Mesure un peu ancienne');
    } else {
      score -= 15;
      details.penalties?.push('Aucune mesure récente');
    }

    for (const key of paramKeys) {
      const value = Number((latest as any)[key]);
      if (!Number.isFinite(value)) continue;

      details.measuredParams = (details.measuredParams ?? 0) + 1;

      const range = targets[key];
      if (!range || (range.min == null && range.max == null)) {
        continue;
      }

      const out =
        (range.min != null && value < Number(range.min)) ||
        (range.max != null && value > Number(range.max));

      if (out) {
        details.outOfRangeParams?.push({
          key,
          value,
          min: range.min ?? null,
          max: range.max ?? null,
        });

        if (key === 'no2' || key === 'nh3') {
          score -= 40;
          details.criticalParams?.push(key);
          details.penalties?.push(`${key.toUpperCase()} critique`);
        } else if (key === 'ph' || key === 'temp') {
          score -= 18;
          details.penalties?.push(`${key.toUpperCase()} hors objectif`);
        } else {
          score -= 10;
          details.penalties?.push(`${key.toUpperCase()} hors objectif`);
        }
      } else {
        details.inRangeParams = (details.inRangeParams ?? 0) + 1;
        score += key === 'no2' || key === 'nh3' ? 8 : 4;
      }
    }

    if ((details.measuredParams ?? 0) >= 5) {
      score += 8;
      details.bonuses?.push('Suivi complet');
    }

    const measurementCount = await this.measurementRepo.count({
      where: { aquariumId: aquarium.id },
    });

    if (measurementCount >= 3) {
      score += 5;
      details.bonuses?.push('Historique suffisant');
    }

    score = this.clamp(score);
    const status = this.statusFromHealthScore(score, details.criticalParams ?? []);

    return this.upsertScore(userId, aquarium.id, score, status, 'HEALTH', details);
  }

  private async safeResolvePremiumTargets(aquariumId: number): Promise<TargetMap> {
    try {
      const resolved = await this.targetsService.resolveTargetMap(aquariumId);
      return (resolved?.targets ?? {}) as TargetMap;
    } catch {
      return {};
    }
  }

  private async upsertScore(
    userId: number,
    aquariumId: number,
    score: number,
    status: AquariumHealthStatus,
    mode: AquariumScoreMode,
    detailsJson: AquariumHealthDetails,
  ): Promise<AquariumHealthScore> {
    const existing = await this.scoreRepo.findOne({ where: { userId, aquariumId } });

    const patch = {
      userId,
      aquariumId,
      score,
      status,
      mode,
      detailsJson,
      computedAt: new Date(),
    };

    if (!existing) return this.scoreRepo.save(this.scoreRepo.create(patch));

    await this.scoreRepo.update({ id: existing.id }, patch);
    return (await this.scoreRepo.findOne({ where: { id: existing.id } }))!;
  }

  private statusFromTrackingScore(score: number): AquariumHealthStatus {
    if (score < 45) return 'UNKNOWN';
    if (score < 70) return 'WATCH';
    return 'STABLE';
  }

  private statusFromHealthScore(score: number, criticalParams: string[]): AquariumHealthStatus {
    if (criticalParams.length > 0 || score < 50) return 'CRITICAL';
    if (score < 80) return 'WATCH';
    return 'STABLE';
  }

  private clamp(score: number): number {
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private daysSince(date: Date): number {
    return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
  }
}
