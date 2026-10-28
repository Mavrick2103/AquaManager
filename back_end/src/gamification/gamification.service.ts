import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Aquarium } from '../aquariums/aquariums.entity';
import { AquariumScoreService } from './score/aquarium-score.service';
import { ProgressionService } from './progression.service';
import { parisDay } from './progression-policy';

@Injectable()
export class GamificationService {
  constructor(
    @InjectRepository(Aquarium) private readonly aquariumRepo: Repository<Aquarium>,
    private readonly scoreService: AquariumScoreService,
    private readonly progression: ProgressionService,
  ) {}

  async getSummary(userId: number) {
    const progress = await this.onAppOpened(userId);
    const scores = await this.scoreService.recomputeAllForUser(userId);
    const aquariums = await this.aquariumRepo.find({
      where: { archivedAt: IsNull(), user: { id: userId } }, order: { createdAt: 'DESC' },
    });
    return {
      ...progress,
      globalScore: scores.length ? Math.round(scores.reduce((sum, row) => sum + row.score, 0) / scores.length) : 0,
      aquariums: aquariums.map(a => {
        const score = scores.find(s => s.aquariumId === a.id);
        return { id: a.id, name: a.name, waterType: a.waterType, volumeL: a.volumeL,
          score: score?.score ?? 0, status: score?.status ?? 'UNKNOWN', mode: score?.mode ?? 'TRACKING', details: score?.detailsJson ?? null };
      }),
    };
  }

  getAquariumScore(userId: number, aquariumId: number) {
    return this.scoreService.getOrCompute(userId, aquariumId);
  }

  async recomputeUser(userId: number) {
    return { ok: true, scores: await this.scoreService.recomputeAllForUser(userId) };
  }

  async onMeasurementCreated(userId: number, aquariumId: number, measurementId: number, comment?: string | null) {
    await this.progression.record(userId, [
      { kind: 'MEASUREMENT', eventKey: `measurement:${measurementId}` },
      ...(comment?.trim() ? [{ kind: 'JOURNAL' as const, eventKey: `journal:${measurementId}` }] : []),
    ]);
    return { score: await this.scoreService.recomputeForAquarium(userId, aquariumId) };
  }

  async onTaskCompleted(userId: number, taskKey: string) {
    return this.progression.record(userId, [{ kind: 'CARE', eventKey: `care:${taskKey}` }]);
  }

  async onTaskCreated(userId: number, taskId: number) {
    return this.progression.record(userId, [{ kind: 'PLAN', eventKey: `plan:${taskId}` }]);
  }

  onAppOpened(userId: number) {
    return this.progression.record(userId, [{ kind: 'VISIT', eventKey: `visit:${parisDay()}` }]);
  }

  onSolutionsOpened(userId: number) {
    return this.progression.record(userId, [{ kind: 'SOLUTIONS', eventKey: `solutions:${parisDay()}` }]);
  }
}
