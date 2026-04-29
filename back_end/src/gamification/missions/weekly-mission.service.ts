import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WeeklyMission } from '../entities/weekly-mission.entity';

type MissionSeed = {
  missionKey: string;
  title: string;
  description: string;
  target: number;
  xpReward: number;
};

const DEFAULT_MISSIONS: MissionSeed[] = [
  {
    missionKey: 'ADD_2_MEASUREMENTS',
    title: 'Ajouter 2 mesures',
    description: 'Ajoute deux mesures cette semaine pour garder un suivi régulier.',
    target: 2,
    xpReward: 80,
  },
  {
    missionKey: 'OPEN_APP_3_DAYS',
    title: 'Suivre ses bacs 3 jours',
    description: 'Reviens au moins 3 jours dans la semaine pour garder le rythme.',
    target: 3,
    xpReward: 60,
  },
  {
    missionKey: 'KEEP_SCORE_85',
    title: 'Garder un bac > 85/100',
    description: 'Maintiens au moins un aquarium au-dessus de 85 de score.',
    target: 7,
    xpReward: 120,
  },
];

@Injectable()
export class WeeklyMissionService {
  constructor(
    @InjectRepository(WeeklyMission)
    private readonly missionRepo: Repository<WeeklyMission>,
  ) {}

  async ensureCurrentWeekMissions(userId: number): Promise<WeeklyMission[]> {
    const { weekStart, weekEnd } = this.getCurrentWeekRange();

    const existing = await this.missionRepo.find({
      where: { userId, weekStart },
      order: { id: 'ASC' },
    });

    if (existing.length) return existing;

    const created: WeeklyMission[] = [];
    for (const seed of DEFAULT_MISSIONS) {
      created.push(
        await this.missionRepo.save(
          this.missionRepo.create({
            userId,
            missionKey: seed.missionKey,
            title: seed.title,
            description: seed.description,
            target: seed.target,
            progress: 0,
            xpReward: seed.xpReward,
            status: 'ACTIVE',
            weekStart,
            weekEnd,
            completedAt: null,
          }),
        ),
      );
    }

    return created;
  }

  async incrementMission(userId: number, missionKey: string, amount = 1): Promise<{ completed: WeeklyMission[] }> {
    const missions = await this.ensureCurrentWeekMissions(userId);
    const mission = missions.find((m) => m.missionKey === missionKey && m.status === 'ACTIVE');

    if (!mission) return { completed: [] };

    mission.progress = Math.min(mission.target, mission.progress + amount);

    const completed: WeeklyMission[] = [];
    if (mission.progress >= mission.target) {
      mission.status = 'COMPLETED';
      mission.completedAt = new Date();
      completed.push(mission);
    }

    await this.missionRepo.save(mission);
    return { completed };
  }

  async updateStableScoreMission(userId: number, hasStableAquarium: boolean) {
    if (!hasStableAquarium) return { completed: [] };
    return this.incrementMission(userId, 'KEEP_SCORE_85', 1);
  }

  async listCurrent(userId: number): Promise<WeeklyMission[]> {
    const missions = await this.ensureCurrentWeekMissions(userId);
    return missions.sort((a, b) => a.id - b.id);
  }

  private getCurrentWeekRange() {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const start = new Date(now);
    start.setDate(now.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return {
      weekStart: this.toDateOnly(start),
      weekEnd: this.toDateOnly(end),
    };
  }

  private toDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
