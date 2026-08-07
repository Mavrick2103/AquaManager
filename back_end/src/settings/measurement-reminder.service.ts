import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { Settings } from './settings.entity';

type ReminderCandidate = {
  settingsId: number;
  email: string;
  fullName: string;
  lastMeasurementAt: Date | string | null;
  firstAquariumAt: Date | string;
  lastReminderAt: Date | string | null;
};

@Injectable()
export class MeasurementReminderService {
  private readonly logger = new Logger(MeasurementReminderService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Settings) private readonly settingsRepo: Repository<Settings>,
    private readonly mail: MailService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM, { timeZone: 'Europe/Paris' })
  async sendInactiveMeasurementReminders(): Promise<void> {
    const candidates = await this.dataSource.query(`
      SELECT
        s.id AS settingsId,
        u.email AS email,
        u.fullName AS fullName,
        MAX(wm.measuredAt) AS lastMeasurementAt,
        MIN(a.createdAt) AS firstAquariumAt,
        s.lastMeasurementReminderAt AS lastReminderAt
      FROM settings s
      INNER JOIN users u ON u.id = s.userId
      INNER JOIN aquariums a ON a.userId = u.id
      LEFT JOIN water_measurements wm ON wm.aquariumId = a.id
      WHERE s.notificationsEnabled = 1
        AND s.emailNotifications = 1
        AND s.automaticNotifications = 1
      GROUP BY s.id, u.email, u.fullName, s.lastMeasurementReminderAt
    `) as ReminderCandidate[];

    const threshold = Date.now() - 14 * 24 * 60 * 60 * 1000;
    for (const candidate of candidates) {
      const activityAt = new Date(candidate.lastMeasurementAt ?? candidate.firstAquariumAt);
      if (!Number.isFinite(activityAt.getTime()) || activityAt.getTime() > threshold) continue;

      const reminderAt = candidate.lastReminderAt ? new Date(candidate.lastReminderAt) : null;
      if (reminderAt && reminderAt.getTime() >= activityAt.getTime()) continue;

      try {
        await this.mail.sendMeasurementReminder(candidate.email, candidate.fullName);
        await this.settingsRepo.update(candidate.settingsId, {
          lastMeasurementReminderAt: new Date(),
        });
      } catch (error) {
        this.logger.error(`Échec du rappel de mesure pour settings#${candidate.settingsId}`, error);
      }
    }
  }
}
