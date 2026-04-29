import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { GamificationProfile } from '../entities/gamification-profile.entity';
import { UserAchievement } from '../entities/user-achievement.entity';

const ACHIEVEMENTS: Record<string, { title: string; description: string }> = {
  FIRST_MEASUREMENT: {
    title: 'Première mesure',
    description: 'Première mesure enregistrée dans AquaManager.',
  },
  SEVEN_DAY_STREAK: {
    title: '7 jours de suivi',
    description: 'Activité régulière pendant 7 jours.',
  },
  //BAC_STABLE: {
  //  title: 'Bac stable',
  //  description: 'Un aquarium atteint un score supérieur ou égal à 85.',
  //},
  XP_1000: {
    title: 'Aquariophile régulier',
    description: '1000 XP gagnés.',
  },
};

@Injectable()
export class AchievementService {
  constructor(
    @InjectRepository(UserAchievement)
    private readonly achievementRepo: Repository<UserAchievement>,
    @InjectRepository(GamificationProfile)
    private readonly profileRepo: Repository<GamificationProfile>,
  ) {}

  async unlock(userId: number, achievementKey: keyof typeof ACHIEVEMENTS): Promise<UserAchievement | null> {
    const meta = ACHIEVEMENTS[achievementKey];
    if (!meta) return null;

    const exists = await this.achievementRepo.exist({
      where: { userId, achievementKey },
    });
    if (exists) return null;

    const unlocked = await this.achievementRepo.save(
      this.achievementRepo.create({
        userId,
        achievementKey,
        title: meta.title,
        description: meta.description,
        unlockedAt: new Date(),
      }),
    );

    await this.profileRepo.update({ userId }, { recentBadgeKey: achievementKey });
    return unlocked;
  }

  async listForUser(userId: number): Promise<UserAchievement[]> {
    return this.achievementRepo.find({
      where: { userId },
      order: { unlockedAt: 'DESC' },
    });
  }
}
