import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource, IsNull, Not } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { Task } from '../tasks/task.entity';
import { parisDate, pendingOccurrencesForDay, REMINDER_TIME_ZONE } from '../tasks/task-reminder-occurrences';
import { Settings } from './settings.entity';
import { AquariumRetentionService } from '../aquariums/aquarium-retention.service';

@Injectable()
export class TaskReminderService {
  private readonly logger = new Logger(TaskReminderService.name);
  private running = false;

  constructor(private readonly dataSource: DataSource, private readonly mail: MailService,
    private readonly retention: AquariumRetentionService) {}

  // Retry within the day after an outage or SMTP failure. Never send before 09:00 Paris.
  @Cron('*/15 * * * *', { timeZone: REMINDER_TIME_ZONE })
  async sendDailyTaskReminders(): Promise<void> {
    const now = new Date();
    const hour = Number(new Intl.DateTimeFormat('en-GB', {
      timeZone: REMINDER_TIME_ZONE, hour: '2-digit', hourCycle: 'h23',
    }).format(now));
    if (hour < 9 || this.running) return;
    this.running = true;
    const runner = this.dataSource.createQueryRunner();
    let locked = false;
    try {
      await runner.connect();
      // MySQL connection-scoped lock also serializes separate API instances.
      const rows = await runner.query("SELECT GET_LOCK('aquamanager:task-reminders', 0) AS acquired");
      locked = Number(rows[0]?.acquired) === 1;
      if (!locked) return;
      const settingsRepo = runner.manager.getRepository(Settings);
      const taskRepo = runner.manager.getRepository(Task);
      const preferences = {
        notificationsEnabled: true, emailNotifications: true, taskReminders: true,
        user: { emailVerifiedAt: Not(IsNull()) },
      };
      const candidates = await settingsRepo.find({ where: preferences, relations: { user: true } });
      const day = parisDate(now);
      for (const candidate of candidates) {
        if (candidate.lastTaskReminderDate === day) continue;
        // Do not let a long batch cross midnight and send yesterday's digest.
        if (parisDate(new Date()) !== day) break;
        try {
          const settings = await settingsRepo.findOne({
            where: { id: candidate.id, ...preferences }, relations: { user: true },
          });
          if (!settings || settings.lastTaskReminderDate === day || !settings.user.email?.trim()) continue;
          await this.retention.reconcile(settings.user.id);
          const tasks = await taskRepo.find({
            where: { user: { id: settings.user.id }, aquarium: { user: { id: settings.user.id }, archivedAt: IsNull() } },
            relations: { aquarium: true },
          });
          const reminders = tasks.flatMap((task) => pendingOccurrencesForDay(task, now).map((dueAt) => ({
            title: task.title, aquariumName: task.aquarium.name, dueAt,
          }))).sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
          if (!reminders.length) continue;
          await this.mail.sendTaskReminder(settings.user.email, settings.user.fullName, reminders);
          await settingsRepo.update(settings.id, { lastTaskReminderDate: day });
        } catch (error) {
          this.logger.error(`Échec du rappel d'entretien pour settings#${candidate.id}`, error);
        }
      }
    } catch (error) {
      this.logger.error("Échec du traitement des rappels d'entretien", error);
    } finally {
      try {
        if (locked) await runner.query("SELECT RELEASE_LOCK('aquamanager:task-reminders')");
      } finally {
        try { await runner.release(); } finally { this.running = false; }
      }
    }
  }
}
