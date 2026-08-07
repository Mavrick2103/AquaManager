import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Settings } from './settings.entity';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { User } from '../users/user.entity';
import { MailModule } from '../mail/mail.module';
import { MeasurementReminderService } from './measurement-reminder.service';

@Module({
  imports: [TypeOrmModule.forFeature([Settings, User]), MailModule],
  controllers: [SettingsController],
  providers: [SettingsService, MeasurementReminderService],
  exports: [SettingsService],
})
export class SettingsModule {}
