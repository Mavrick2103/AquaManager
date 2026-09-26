import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Settings } from './settings.entity';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { User } from '../users/user.entity';
import { MailModule } from '../mail/mail.module';
import { MeasurementReminderService } from './measurement-reminder.service';
import { TaskReminderService } from './task-reminder.service';
import { Task } from '../tasks/task.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Settings, User, Task]), MailModule],
  controllers: [SettingsController],
  providers: [SettingsService, MeasurementReminderService, TaskReminderService],
  exports: [SettingsService],
})
export class SettingsModule {}
