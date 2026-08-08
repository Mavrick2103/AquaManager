import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../mail/mail.module';
import { User } from '../users/user.entity';
import { AdminEmailingController } from './admin-emailing.controller';
import { AdminEmailingService } from './admin-emailing.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), MailModule],
  controllers: [AdminEmailingController],
  providers: [AdminEmailingService],
})
export class AdminEmailingModule {}
