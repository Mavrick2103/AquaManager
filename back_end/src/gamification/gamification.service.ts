import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Aquarium } from '../aquariums/aquariums.entity';
import { AquariumHealthScore } from './entities/aquarium-health-score.entity';
import { GamificationProfile } from './entities/gamification-profile.entity';
import { AquariumScoreService } from './score/aquarium-score.service';
import { WeeklyMissionService } from './missions/weekly-mission.service';
import { AchievementService } from './achievements/achievement.service';

@Injectable()
export class GamificationService {
  constructor(
    @InjectRepository(GamificationProfile)
    private readonly profileRepo: Repository<GamificationProfile>,

    @InjectRepository(Aquarium)
    private readonly aquariumRepo: Repository<Aquarium>,

    @InjectRepository(AquariumHealthScore)
    private readonly scoreRepo: Repository<AquariumHealthScore>,

    private readonly scoreService: AquariumScoreService,
    private readonly missionService: WeeklyMissionService,
    private readonly achievementService: AchievementService,
  ) {}

  async getSummary(userId: number) {
    const profile = await this.ensureProfile(userId);
    const levelInfo = this.getLevelInfoFromXp(profile.xp);

    const scores = await this.scoreService.recomputeAllForUser(userId);

    const globalScore = scores.length
      ? Math.round(scores.reduce((sum, row) => sum + row.score, 0) / scores.length)
      : 0;

    const aquariums = await this.aquariumRepo.find({
      where: { user: { id: userId } as any },
      order: { createdAt: 'DESC' as any },
    });

    const missions = await this.missionService.listCurrent(userId);
    const achievements = await this.achievementService.listForUser(userId);

    return {
      globalScore,

      profile: {
        xp: profile.xp,
        level: levelInfo.level,
        currentStreak: profile.currentStreak,
        bestStreak: profile.bestStreak,
        recentBadgeKey: profile.recentBadgeKey,
        xpForCurrentLevel: levelInfo.xpForCurrentLevel,
        xpForNextLevel: levelInfo.xpForNextLevel,
      },

      aquariums: aquariums.map((a) => {
        const score = scores.find((s) => s.aquariumId === a.id);

        return {
          id: a.id,
          name: a.name,
          waterType: a.waterType,
          volumeL: a.volumeL,
          score: score?.score ?? 0,
          status: score?.status ?? 'UNKNOWN',
          mode: score?.mode ?? 'TRACKING',
          details: score?.detailsJson ?? null,
        };
      }),

      missions: missions.map((m) => ({
        id: m.id,
        missionKey: m.missionKey,
        title: m.title,
        description: m.description,
        target: m.target,
        progress: m.progress,
        xpReward: m.xpReward,
        status: m.status,
        weekStart: m.weekStart,
        weekEnd: m.weekEnd,
      })),

      achievements: achievements.map((a) => ({
        id: a.id,
        achievementKey: a.achievementKey,
        title: a.title,
        description: a.description,
        unlockedAt: a.unlockedAt,
      })),
    };
  }

  async getAquariumScore(userId: number, aquariumId: number) {
    return this.scoreService.getOrCompute(userId, aquariumId);
  }

  async recomputeUser(userId: number) {
    const scores = await this.scoreService.recomputeAllForUser(userId);
    return { ok: true, scores };
  }

  async onMeasurementCreated(userId: number, aquariumId: number) {
    await this.addXp(userId, 10);
    await this.updateActivityStreak(userId);

    const { completed } = await this.missionService.incrementMission(
      userId,
      'ADD_2_MEASUREMENTS',
      1,
    );

    for (const mission of completed) {
      await this.addXp(userId, mission.xpReward);
    }

    // Badge première mesure
    await this.unlockBadge(userId, 'FIRST_MEASUREMENT');

    const score = await this.scoreService.recomputeForAquarium(userId, aquariumId);

    if (score.score >= 85) {
      await this.unlockBadge(userId, 'BAC_STABLE');

      const missionResult = await this.missionService.updateStableScoreMission(userId, true);

      for (const mission of missionResult.completed) {
        await this.addXp(userId, mission.xpReward);
      }
    }

    const profile = await this.ensureProfile(userId);

    if (profile.xp >= 1000) {
      await this.unlockBadge(userId, 'XP_1000');
    }

    return { score };
  }

  async onTaskCompleted(userId: number, aquariumId?: number | null) {
    await this.addXp(userId, 15);
    await this.updateActivityStreak(userId);

    if (aquariumId) {
      await this.scoreService.recomputeForAquarium(userId, aquariumId);
    }
  }

  async onAppOpened(userId: number) {
    await this.updateActivityStreak(userId);

    const { completed } = await this.missionService.incrementMission(
      userId,
      'OPEN_APP_3_DAYS',
      1,
    );

    for (const mission of completed) {
      await this.addXp(userId, mission.xpReward);
    }
  }

  /**
   * Débloque un badge + le met en badge récent pour l'affichage Home.
   */
  private async unlockBadge(userId: number, badgeKey: string): Promise<void> {
  try {
    await this.achievementService.unlock(userId, badgeKey as any);
  } catch (error) {
    console.error('Erreur unlock badge:', badgeKey, error);
  }

  const profile = await this.ensureProfile(userId);

  profile.recentBadgeKey = badgeKey;

  await this.profileRepo.save(profile);
}

  private async ensureProfile(userId: number): Promise<GamificationProfile> {
    let profile = await this.profileRepo.findOne({ where: { userId } });

    if (profile) {
      return profile;
    }

    profile = this.profileRepo.create({
      userId,
      xp: 0,
      level: 1,
      currentStreak: 0,
      bestStreak: 0,
      lastActivityDate: null,
      recentBadgeKey: null,
    });

    return this.profileRepo.save(profile);
  }

  private async addXp(userId: number, amount: number): Promise<GamificationProfile> {
    const profile = await this.ensureProfile(userId);

    profile.xp = Math.max(0, profile.xp + amount);

    const levelInfo = this.getLevelInfoFromXp(profile.xp);
    profile.level = levelInfo.level;

    return this.profileRepo.save(profile);
  }

  private async updateActivityStreak(userId: number): Promise<GamificationProfile> {
    const profile = await this.ensureProfile(userId);

    const today = this.toDateOnly(new Date());

    if (profile.lastActivityDate === today) {
      return profile;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = this.toDateOnly(yesterday);

    if (profile.lastActivityDate === yesterdayStr) {
      profile.currentStreak += 1;
    } else {
      profile.currentStreak = 1;
    }

    profile.bestStreak = Math.max(profile.bestStreak, profile.currentStreak);
    profile.lastActivityDate = today;

    const saved = await this.profileRepo.save(profile);

    if (saved.currentStreak >= 7) {
      await this.unlockBadge(userId, 'SEVEN_DAY_STREAK');
    }

    return saved;
  }

  /**
   * Courbe d'XP progressive :
   * niveau 1 = 0 XP
   * niveau 2 = 100 XP
   * niveau 3 = 300 XP
   * niveau 4 = 550 XP
   * niveau 5 = 850 XP
   */
  private getLevelInfoFromXp(xp: number): {
    level: number;
    xpForCurrentLevel: number;
    xpForNextLevel: number;
  } {
    const safeXp = Math.max(0, Math.floor(Number(xp) || 0));

    let level = 1;
    let xpForCurrentLevel = 0;
    let xpForNextLevel = 100;

    while (safeXp >= xpForNextLevel) {
      level++;
      xpForCurrentLevel = xpForNextLevel;

      // Plus le niveau monte, plus le niveau suivant demande d'XP
      xpForNextLevel += 100 + level * 50;
    }

    return {
      level,
      xpForCurrentLevel,
      xpForNextLevel,
    };
  }

  private toDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}