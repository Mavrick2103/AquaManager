import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { Settings } from '../settings/settings.entity';
import { User } from '../users/user.entity';
import { AdminEmailAudienceDto, ConsentFilter, EmailAudience, SendAdminEmailDto } from './dto/admin-email.dto';

type Recipient = { id: number; fullName: string; email: string; lastActivityAt: Date | null; optedIn: boolean };

@Injectable()
export class AdminEmailingService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly mail: MailService,
  ) {}

  async preview(dto: AdminEmailAudienceDto) {
    const recipients = await this.recipientQuery(dto).getRawMany();
    return {
      count: recipients.length,
      optedInCount: recipients.filter((item) => Boolean(Number(item.optedIn))).length,
      recipients: recipients.slice(0, 100).map((item) => this.mapRecipient(item)),
      truncated: recipients.length > 100,
    };
  }

  async send(dto: SendAdminEmailDto) {
    const raw = await this.recipientQuery(dto).getRawMany();
    const recipients = raw.map((item) => this.mapRecipient(item));
    if (!recipients.length) throw new BadRequestException('Aucun destinataire ne correspond à ce filtre.');

    let sent = 0;
    const failed: number[] = [];
    for (let index = 0; index < recipients.length; index += 5) {
      const batch = recipients.slice(index, index + 5);
      const results = await Promise.allSettled(batch.map((recipient) =>
        this.mail.sendAdminMessage({
          to: recipient.email,
          fullName: recipient.fullName,
          subject: dto.subject.trim(),
          message: dto.message.trim(),
          actionUrl: dto.actionUrl?.trim() || undefined,
          actionLabel: dto.actionLabel?.trim() || undefined,
        }),
      ));
      results.forEach((result, resultIndex) => {
        if (result.status === 'fulfilled') sent += 1;
        else failed.push(batch[resultIndex].id);
      });
    }
    return { requested: recipients.length, sent, failed: failed.length, failedUserIds: failed };
  }

  private recipientQuery(dto: AdminEmailAudienceDto): SelectQueryBuilder<User> {
    if (dto.audience === EmailAudience.INACTIVE && !dto.inactiveDays) {
      throw new BadRequestException("Indiquez le nombre de jours d'inactivité.");
    }
    if (dto.audience === EmailAudience.SINGLE_USER && !dto.userId) {
      throw new BadRequestException('Sélectionnez un utilisateur.');
    }

    const query = this.users.createQueryBuilder('u')
      .leftJoin(Settings, 's', 's.userId = u.id')
      .select('u.id', 'id')
      .addSelect('u.fullName', 'fullName')
      .addSelect('u.email', 'email')
      .addSelect('u.lastActivityAt', 'lastActivityAt')
      .addSelect('CASE WHEN s.notificationsEnabled = 1 AND s.emailNotifications = 1 AND s.newsAndUpdates = 1 THEN 1 ELSE 0 END', 'optedIn')
      .where("u.email IS NOT NULL AND TRIM(u.email) <> ''")
      .orderBy('u.id', 'ASC');

    if (dto.audience === EmailAudience.INACTIVE) {
      const since = new Date(Date.now() - Number(dto.inactiveDays) * 86_400_000);
      query.andWhere('(u.lastActivityAt IS NULL OR u.lastActivityAt < :since)', { since });
    } else if (dto.audience === EmailAudience.NEVER_CONNECTED) {
      query.andWhere('u.lastActivityAt IS NULL');
    } else if (dto.audience === EmailAudience.SINGLE_USER) {
      query.andWhere('u.id = :userId', { userId: dto.userId });
    }

    const optedInSql = 's.notificationsEnabled = 1 AND s.emailNotifications = 1 AND s.newsAndUpdates = 1';
    if (dto.consent === ConsentFilter.OPTED_IN) query.andWhere(optedInSql);
    if (dto.consent === ConsentFilter.OPTED_OUT) query.andWhere(`NOT (${optedInSql}) OR s.id IS NULL`);
    return query;
  }

  private mapRecipient(item: any): Recipient {
    return {
      id: Number(item.id),
      fullName: item.fullName || String(item.email).split('@')[0],
      email: item.email,
      lastActivityAt: item.lastActivityAt ?? null,
      optedIn: Boolean(Number(item.optedIn)),
    };
  }
}
