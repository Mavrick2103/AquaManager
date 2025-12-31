import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';

class NoopMailService {
  async sendVerifyEmail() { return; }
  async sendResetPassword() { return; }
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MailService,
      useClass: process.env.NODE_ENV === 'test' ? NoopMailService : MailService,
    },
  ],
  exports: [MailService],
})
export class MailModule {}
