import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, LessThan } from 'typeorm';
import { GamificationActivity } from './entities/gamification-activity.entity';
import { GamificationProfile } from './entities/gamification-profile.entity';
import { WeeklyMission } from './entities/weekly-mission.entity';
import { UserAchievement } from './entities/user-achievement.entity';
import { User } from '../users/user.entity';
import { ActivityCounts, ActivityKind, BADGES, DAILY_XP, MISSION_CATALOG, TITLES, badgeProgress, legacyMissionKind, levelInfo, monthlyRange, parisDay, selectMonthlyMissions } from './progression-policy';

@Injectable()
export class ProgressionService {
  constructor(private readonly db: DataSource) {}

  // All events for a user serialize on the account, even before its first profile.
  // The receipt, mission bonus,
  // badges and XP commit together, including when two browser tabs are open.
  async record(userId: number, events: Array<{ kind: ActivityKind; eventKey: string }> = [], now = new Date()) {
    return this.db.transaction(async manager => {
      await manager.getRepository(User).findOneOrFail({ where: { id: userId }, select: { id: true }, lock: { mode: 'pessimistic_write' } });
      const profiles = manager.getRepository(GamificationProfile);
      const profile = await profiles.findOne({ where: { userId }, lock: { mode: 'pessimistic_write' } })
        ?? profiles.create({ userId, xp: 0, level: 1, currentStreak: 0, bestStreak: 0, recentBadgeKey: null, lastActivityDate: null });
      const today = parisDay(now);
      const { weekStart, weekEnd } = monthlyRange(today);
      const activities = manager.getRepository(GamificationActivity);
      for (const event of events) {
        if (await activities.exist({ where: { userId, eventKey: event.eventKey } })) continue;
        const alreadyToday = await activities.exist({ where: { userId, kind: event.kind, activityDate: today } });
        await activities.insert({ userId, ...event, activityDate: today });
        if (!alreadyToday) profile.xp += DAILY_XP[event.kind];
      }
      const monthly = await this.counts(manager, userId, weekStart);
      const total = await this.counts(manager, userId);
      profile.currentStreak = monthly.VISIT ?? 0;
      profile.bestStreak = Math.max(profile.bestStreak, profile.currentStreak);
      if (events.some(event => event.kind === 'VISIT')) profile.lastActivityDate = today;

      const missions = manager.getRepository(WeeklyMission);
      await missions.update({ userId, status: 'ACTIVE', weekEnd: LessThan(today) }, { status: 'EXPIRED' });
      const current = await missions.find({ where: { userId, weekStart }, order: { id: 'ASC' } });
      // Stored selection wins: no reshuffle on refresh or deployment mid-month.
      const stored = current.filter(row => row.status !== 'EXPIRED')
        .map(row => MISSION_CATALOG.find(seed => seed.missionKey === row.missionKey))
        .filter((seed): seed is NonNullable<typeof seed> => !!seed);
      const selection = stored.length ? stored : selectMonthlyMissions(userId, today);
      // Replace old random missions that encouraged purchases or needless care.
      // Earned XP and completed missions are retained.
      for (const old of current) {
        if (old.status === 'ACTIVE' && !MISSION_CATALOG.some(seed => seed.missionKey === old.missionKey)) {
          old.status = 'EXPIRED';
          await missions.save(old);
        }
      }
      const active: WeeklyMission[] = [];
      for (const seed of selection.filter((seed, index, all) => all.findIndex(other => other.kind === seed.kind) === index)) {
        // A legacy goal already rewarded this month occupies its category.
        // Never add a second mission/bonus for the same objective at rollout.
        const legacyCompleted = current.find(row => row.status === 'COMPLETED' && legacyMissionKind(row.missionKey) === seed.kind);
        let mission = current.find(row => row.missionKey === seed.missionKey);
        if (legacyCompleted) {
          // Persist the occupied slot as completed, without awarding XP again.
          // This also keeps all four slots stable on the next request.
          if (!mission) mission = await missions.save(missions.create({
            userId, missionKey: seed.missionKey, weekStart, weekEnd,
            title: legacyCompleted.title, description: legacyCompleted.description,
            target: legacyCompleted.target, progress: legacyCompleted.target,
            xpReward: legacyCompleted.xpReward, status: 'COMPLETED', completedAt: legacyCompleted.completedAt,
          }));
          active.push(mission);
          continue;
        }
        if (!mission) {
          const { kind, ...fields } = seed;
          mission = missions.create({ ...fields, userId, weekStart, weekEnd, progress: 0, status: 'ACTIVE', completedAt: null });
        }
        if (mission.status !== 'COMPLETED') {
          mission.progress = Math.min(mission.target, monthly[seed.kind] ?? 0);
          if (mission.progress >= mission.target) {
            mission.status = 'COMPLETED';
            mission.completedAt = now;
            profile.xp += mission.xpReward;
          }
          await missions.save(mission);
        }
        active.push(mission);
      }
      const earned = await manager.getRepository(UserAchievement).find({ where: { userId }, order: { unlockedAt: 'DESC' } });
      const completed = active.filter(mission => mission.status === 'COMPLETED' && mission.missionKey.startsWith('V2_')).length;
      const catalog: Array<{ achievementKey: string; title: string; description: string; progress: number; target: number; unlockedAt: Date | null }> = [];
      for (const badge of BADGES) {
        const progress = Math.min(badge.target, badgeProgress(badge.kind, total, monthly, completed, profile.xp));
        let achievement = earned.find(row => row.achievementKey === badge.key);
        if (!achievement && progress >= badge.target) {
          achievement = await manager.getRepository(UserAchievement).save({
            userId, achievementKey: badge.key, title: badge.title, description: badge.description, unlockedAt: now,
          });
          earned.unshift(achievement);
          profile.recentBadgeKey = badge.key;
        }
        catalog.push({ achievementKey: badge.key, title: badge.title, description: badge.description,
          progress: achievement ? badge.target : progress, target: badge.target, unlockedAt: achievement?.unlockedAt ?? null });
      }
      const level = levelInfo(profile.xp);
      profile.level = level.level;
      await profiles.save(profile);
      return {
        profile: { ...profile, ...level },
        missions: active,
        achievements: earned,
        badgeCatalog: catalog,
        rewards: TITLES.map(reward => ({ ...reward, unlocked: profile.xp >= reward.xp })),
        currentTitle: [...TITLES].reverse().find(reward => profile.xp >= reward.xp)!.title,
      };
    });
  }

  private async counts(manager: EntityManager, userId: number, since?: string): Promise<ActivityCounts> {
    const query = manager.getRepository(GamificationActivity).createQueryBuilder('activity')
      .select('activity.kind', 'kind').addSelect('COUNT(DISTINCT activity.activityDate)', 'days')
      .where('activity.userId = :userId', { userId }).groupBy('activity.kind');
    if (since) query.andWhere('activity.activityDate >= :since', { since });
    const rows = await query.getRawMany<{ kind: ActivityKind; days: string }>();
    return Object.fromEntries(rows.map(row => [row.kind, Number(row.days)]));
  }
}
