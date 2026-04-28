import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';

import {
  Recommendation,
  RecommendationStatus,
} from './recommendation.entity';
import { WaterMeasurement } from '../water-measurement/water-measurement.entity';
import { buildDefaultWaterRules } from './rules/default-water-rules';
import { TaskService } from '../tasks/task.service';
import { AquariumTargetsService } from '../aquarium-targets/aquarium-targets.service';

@Injectable()
export class RecommendationService {
  constructor(
    @InjectRepository(Recommendation)
    private readonly repo: Repository<Recommendation>,
    private readonly taskService: TaskService,
    private readonly aquariumTargetsService: AquariumTargetsService,
  ) {}

  /**
   * Crée des recommandations "PENDING" à partir d'une mesure.
   * (La création est idempotente: pas de doublon dans les dernières 24h)
   */
  async generateForMeasurement(params: {
    userId: number;
    aquariumId: number;
    measurement: WaterMeasurement;
  }): Promise<Recommendation[]> {
    const { userId, aquariumId, measurement } = params;

    // On ne garde qu'un "lot" de reco sur la dernière mesure :
    // toute reco PENDING précédente devient EXPIRED.
    await this.repo
      .createQueryBuilder()
      .update(Recommendation)
      .set({ status: RecommendationStatus.EXPIRED })
      .where('userId = :userId', { userId })
      .andWhere('aquariumId = :aquariumId', { aquariumId })
      .andWhere('status = :status', { status: RecommendationStatus.PENDING })
      .execute();

    const { targets } = await this.aquariumTargetsService.resolveTargetMap(aquariumId);

    const rules = buildDefaultWaterRules(targets);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const created: Recommendation[] = [];

    for (const rule of rules) {
      if (!rule.when(measurement, targets)) continue;

      // Anti-spam: si une reco PENDING de même ruleKey existe déjà dans les 24h
      const exists = await this.repo.exist({
        where: {
          userId,
          aquariumId,
          ruleKey: rule.key,
          status: RecommendationStatus.PENDING,
          createdAt: MoreThan(since) as any,
        } as any,
      });
      if (exists) continue;

      const built = rule.build({ measurement, aquariumId, targets });

      const reco = this.repo.create({
        userId,
        aquariumId,
        measurementId: measurement.id,
        ruleKey: built.ruleKey,
        title: built.title,
        message: built.message,
        severity: built.severity,
        status: RecommendationStatus.PENDING,
        actionType: 'CREATE_TASK',
        actionPayload: built.action.payload,
        decidedAt: null,
      });

      created.push(await this.repo.save(reco));
    }

    return created;
  }

  // Purge automatique :
  // - EXPIRED > 7 jours
  // - ACCEPTED/REJECTED > 30 jours
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeOldRecommendations() {
    const now = Date.now();
    const expiredBefore = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const decidedBefore = new Date(now - 30 * 24 * 60 * 60 * 1000);

    await this.repo
      .createQueryBuilder()
      .delete()
      .from(Recommendation)
      .where('status = :status', { status: RecommendationStatus.EXPIRED })
      .andWhere('createdAt < :expiredBefore', { expiredBefore })
      .execute();

    await this.repo
      .createQueryBuilder()
      .delete()
      .from(Recommendation)
      .where('status IN (:...statuses)', {
        statuses: [RecommendationStatus.ACCEPTED, RecommendationStatus.REJECTED],
      })
      .andWhere('decidedAt IS NOT NULL')
      .andWhere('decidedAt < :decidedBefore', { decidedBefore })
      .execute();
  }

  async listPending(userId: number, aquariumId?: number) {
    return this.repo.find({
      where: {
        userId,
        status: RecommendationStatus.PENDING,
        ...(aquariumId ? { aquariumId } : {}),
      } as any,
      order: { createdAt: 'DESC' },
    });
  }

  async accept(userId: number, id: number) {
    const reco = await this.repo.findOne({ where: { id } });
    if (!reco || reco.userId !== userId) throw new NotFoundException('Recommandation introuvable');
    if (reco.status !== RecommendationStatus.PENDING)
      throw new BadRequestException('Recommandation déjà traitée');

    const payload = reco.actionPayload;
    if (!payload || !payload.aquariumId || !payload.dueAt || !payload.type) {
      throw new BadRequestException('Action invalide');
    }

    // On utilise la logique existante du TaskService (validations + titres auto)
    const createdTask = await this.taskService.create(userId, {
      aquariumId: payload.aquariumId,
      type: payload.type,
      title: payload.title,
      description: payload.description,
      dueAt: payload.dueAt,
      repeat: null,
      fertilization: null,
    } as any);

    reco.status = RecommendationStatus.ACCEPTED;
    reco.decidedAt = new Date();
    await this.repo.save(reco);

    return { recommendation: reco, createdTask };
  }

  async reject(userId: number, id: number) {
    const reco = await this.repo.findOne({ where: { id } });
    if (!reco || reco.userId !== userId) throw new NotFoundException('Recommandation introuvable');
    if (reco.status !== RecommendationStatus.PENDING)
      throw new BadRequestException('Recommandation déjà traitée');

    reco.status = RecommendationStatus.REJECTED;
    reco.decidedAt = new Date();
    await this.repo.save(reco);

    return { recommendation: reco };
  }
}
