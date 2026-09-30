import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { Aquarium } from './aquariums.entity';
import { User } from '../users/user.entity';

export function retentionDeadline(start: Date): Date {
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  // A leap-day anniversary falls on February 28 in a non-leap year.
  if (end.getUTCMonth() !== start.getUTCMonth()) end.setUTCDate(0);
  return end;
}

export function aquariumAllowance(user: User, now: Date): number {
  if (['ADMIN', 'SUPERADMIN'].includes(String(user.role))) return Infinity;
  const active = ['active', 'trialing'].includes(String(user.subscriptionStatus))
    && (!user.subscriptionEndsAt || new Date(user.subscriptionEndsAt) > now);
  if (!active) return 2;
  return user.subscriptionPlan === 'PRO' ? Infinity : user.subscriptionPlan === 'PREMIUM' ? 5 : 2;
}

@Injectable()
export class AquariumRetentionService {
  private readonly logger = new Logger(AquariumRetentionService.name);
  constructor(private readonly source: DataSource) {}

  async reconcile(userId: number, purge = false, now = new Date()): Promise<void> {
    await this.source.transaction(async manager => {
      // Same row lock as aquarium creation: serialize quota, restoration and purge.
      const user = await manager.getRepository(User).findOne({
        where: { id: userId }, lock: { mode: 'pessimistic_write' },
      });
      if (!user) return;
      const repo = manager.getRepository(Aquarium);
      const aquariums = await repo.find({
        where: { user: { id: userId } }, order: { createdAt: 'ASC', id: 'ASC' },
      });
      const allowance = aquariumAllowance(user, now);
      const paid = allowance > 2;
      let activeCount = 0;
      for (const aquarium of aquariums) {
        // On Classic, deleting a visible aquarium must not unlock an archived one.
        const accessible = activeCount < allowance && (paid || !aquarium.archivedAt);
        if (accessible) {
          activeCount++;
          if (aquarium.archivedAt) await repo.update(aquarium.id, { archivedAt: null, archiveExpiresAt: null });
          continue;
        }
        const lastPaidEnd = user.subscriptionEndsAt ? new Date(user.subscriptionEndsAt) : null;
        // A later paid period resets retention even if no request occurred while it was active.
        const renewedSinceArchive = aquarium.archivedAt && lastPaidEnd
          && lastPaidEnd > aquarium.archivedAt && lastPaidEnd <= now;
        if (!aquarium.archivedAt || renewedSinceArchive) {
          // Existing over-quota accounts receive a full year on rollout. For newly
          // expired access, anchor to the actual end of the paid period.
          const recentEnd = lastPaidEnd && lastPaidEnd <= now
            && now.getTime() - lastPaidEnd.getTime() <= 86_400_000;
          const archivedAt = renewedSinceArchive ? lastPaidEnd! : recentEnd ? lastPaidEnd! : now;
          await repo.update(aquarium.id, { archivedAt, archiveExpiresAt: retentionDeadline(archivedAt) });
          continue;
        }
        if (purge && aquarium.archiveExpiresAt && aquarium.archiveExpiresAt <= now) {
          // Some historical tables have no FK: remove their records explicitly.
          const taskIds: { id: number }[] = await manager.query('SELECT id FROM tasks WHERE aquariumId = ?', [aquarium.id]);
          if (taskIds.length) {
            await manager.createQueryBuilder().delete().from('task_fertilizers')
              .where('taskId IN (:...ids)', { ids: taskIds.map(t => t.id) }).execute();
          }
          for (const table of ['tasks', 'water_measurements', 'aquarium_targets',
            'aquarium_fish_cards', 'aquarium_plant_cards', 'aquarium_health_scores',
            'recommendations', 'ai_usage', 'feature_usage_events']) {
            await manager.createQueryBuilder().delete().from(table)
              .where('aquariumId = :id', { id: aquarium.id }).execute();
          }
          await repo.delete(aquarium.id);
        }
      }
    });
  }

  @Cron('10 * * * *')
  async sweep(): Promise<void> {
    let cursor = 0;
    while (true) {
      const users: { userId: number }[] = await this.source.query(
        'SELECT DISTINCT userId FROM aquariums WHERE userId > ? ORDER BY userId LIMIT 100', [cursor],
      );
      if (!users.length) break;
      for (const { userId } of users) {
        try { await this.reconcile(Number(userId), true); }
        catch (error) { this.logger.error(`Aquarium retention failed for user ${userId}`, error); }
      }
      cursor = Number(users[users.length - 1].userId);
    }
  }
}
