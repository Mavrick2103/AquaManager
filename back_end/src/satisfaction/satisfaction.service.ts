import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { User } from '../users/user.entity';
import { SatisfactionResponse, SatisfactionState } from './satisfaction.entity';
import { SubmitSatisfactionDto } from './satisfaction.dto';
import { audience, eligibility, DAY, nextSurveyMonth } from './satisfaction.policy';
@Injectable()
export class SatisfactionService {
  constructor(private readonly db: DataSource) {}
  private async locked<T>(
    id: number,
    action: (
      m: EntityManager,
      user: User,
      state: SatisfactionState,
    ) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (m) => {
      const user = await m.findOne(User, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException();
      const state =
        (await m.findOneBy(SatisfactionState, { userId: id })) ??
        m.create(SatisfactionState, {
          userId: id,
          visitDays: 0,
          lastVisitDay: null,
          lastResponseAt: null,
          dismissedUntil: null,
        });
      return action(m, user, state);
    });
  }
  async status(id: number) {
    const user = await this.db.getRepository(User).findOneBy({ id });
    if (!user) throw new NotFoundException();
    const state = await this.db
      .getRepository(SatisfactionState)
      .findOneBy({ userId: id });
    return eligibility(
      user,
      state ?? { visitDays: 0, lastResponseAt: null, dismissedUntil: null },
    );
  }
  visit(id: number) {
    return this.locked(id, async (m, user, state) => {
      const now = new Date(),
        today = now.toISOString().slice(0, 10);
      if (state.lastVisitDay !== today) {
        state.visitDays = Math.min(3, state.visitDays + 1);
        state.lastVisitDay = today;
      }
      const access = eligibility(user, state, now);
      // Claim the monthly invitation under the account lock, including across tabs/devices.
      if (access.prompt) state.dismissedUntil = nextSurveyMonth(now);
      await m.save(state);
      return access;
    });
  }
  dismiss(id: number) {
    return this.locked(id, async (m, user, state) => {
      state.dismissedUntil = nextSurveyMonth(new Date());
      await m.save(state);
      return { ok: true };
    });
  }
  submit(id: number, dto: SubmitSatisfactionDto) {
    return this.locked(id, async (m, user, state) => {
      const now = new Date(),
        access = eligibility(user, state, now);
      if (!access.canSubmit)
        throw new ConflictException(
          'Tu as déjà donné ton avis. Tu pourras répondre à nouveau un mois après ta dernière réponse.',
        );
      if (access.segment === 'PREMIUM' && dto.premiumRating == null)
        throw new BadRequestException(
          'Merci de noter aussi les fonctionnalités Premium.',
        );
      if (access.segment === 'CLASSIC' && dto.premiumRating != null)
        throw new BadRequestException(
          'La note Premium est réservée aux utilisateurs Premium.',
        );
      await m.save(
        m.create(SatisfactionResponse, {
          userId: id,
          ...audience(user, now),
          rating: dto.rating,
          premiumRating: dto.premiumRating ?? null,
          comment: (dto.comment ?? '').trim(),
          status: 'NEW',
          createdAt: now,
        }),
      );
      state.lastResponseAt = now;
      await m.save(state);
      return { ok: true };
    });
  }
  async list(q: {
    segment?: string;
    source?: string;
    days?: string;
    page?: string;
    status?: string;
  }) {
    const page = Math.max(
      1,
      Math.min(100000, Number.parseInt(q.page ?? '1', 10) || 1),
    );
    const builder = this.db
      .getRepository(SatisfactionResponse)
      .createQueryBuilder('r');
    if (['CLASSIC', 'PREMIUM'].includes(q.segment ?? ''))
      builder.andWhere('r.segment = :segment', { segment: q.segment });
    if (['FREE', 'PAID', 'GIFT', 'STAFF'].includes(q.source ?? ''))
      builder.andWhere('r.source = :source', { source: q.source });
    else if (q.source !== 'ALL')
      builder.andWhere('r.source != :staff', { staff: 'STAFF' });
    if (q.days !== 'all') {
      const days = ['30', '90', '365'].includes(q.days ?? '')
        ? Number(q.days)
        : 90;
      builder.andWhere('r.createdAt >= :since', {
        since: new Date(Date.now() - days * DAY),
      });
    }
    const totals = await builder
      .clone()
      .select('r.segment', 'segment')
      .addSelect('COUNT(*)', 'count')
      .addSelect('AVG(r.rating)', 'average')
      .addSelect('SUM(CASE WHEN r.rating >= 4 THEN 1 ELSE 0 END)', 'satisfied')
      .addSelect('AVG(r.premiumRating)', 'premiumAverage')
      .addSelect('COUNT(r.premiumRating)', 'premiumCount')
      .addSelect(
        'SUM(CASE WHEN r.premiumRating >= 4 THEN 1 ELSE 0 END)',
        'premiumSatisfied',
      )
      .addSelect(
        [1, 2, 3, 4, 5].map(
          (n) =>
            'SUM(CASE WHEN r.rating = ' + n + ' THEN 1 ELSE 0 END) AS n' + n,
        ),
      )
      .groupBy('r.segment')
      .getRawMany();
    const monthly = await builder
      .clone()
      .select("DATE_FORMAT(r.createdAt, '%Y-%m')", 'month')
      .addSelect('r.segment', 'segment')
      .addSelect('COUNT(*)', 'count')
      .addSelect('AVG(r.rating)', 'average')
      .addSelect('SUM(CASE WHEN r.rating >= 4 THEN 1 ELSE 0 END)', 'satisfied')
      .groupBy('month')
      .addGroupBy('r.segment')
      .orderBy('month', 'DESC')
      .limit(24)
      .getRawMany();
    if (['NEW', 'READ', 'DONE'].includes(q.status ?? ''))
      builder.andWhere('r.status = :status', { status: q.status });
    const [items, total] = await builder
      .leftJoinAndSelect('r.user', 'u')
      .select(['r', 'u.id', 'u.fullName'])
      .orderBy('r.createdAt', 'DESC')
      .addOrderBy('r.id', 'DESC')
      .skip((page - 1) * 20)
      .take(20)
      .getManyAndCount();
    return { totals, monthly, items, total, page, pageSize: 20 };
  }
  async review(id: number, status: string) {
    const result = await this.db
      .getRepository(SatisfactionResponse)
      .update(id, { status });
    if (!result.affected) throw new NotFoundException();
    return { ok: true };
  }
}
