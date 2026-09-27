import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PaypalPayment, PaypalSubscription } from './paypal-subscription.entity';
import { PaypalAdminAction } from './paypal-admin-action.entity';
import { PaypalService } from './paypal.service';
import { PaypalApiService } from './paypal-api.service';

@Injectable()
export class PaypalAdminService {
  constructor(private readonly db: DataSource, private readonly paypal: PaypalService, private readonly api: PaypalApiService) {}

  async list(search = '', page = 1, environment = 'all', attention = false) {
    if (!Number.isInteger(page) || page < 1 || page > 100000 || search.length > 160
        || !['all', 'sandbox', 'live'].includes(environment)) throw new BadRequestException('Filtres invalides.');
    const qb = this.db.getRepository(PaypalSubscription).createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'u')
      .select(['s.id', 's.userId', 's.paypalId', 's.environment', 's.status', 's.paidUntil', 's.syncedAt', 's.createdAt',
        'u.id', 'u.email', 'u.fullName', 'u.subscriptionPlan', 'u.subscriptionStatus', 'u.subscriptionEndsAt', 'u.billingProvider', 'u.paypalSubscriptionId']);
    if (search.trim()) qb.andWhere('(u.email LIKE :search OR u.fullName LIKE :search OR s.paypalId LIKE :search)', { search: `%${search.trim()}%` });
    if (environment !== 'all') qb.andWhere('s.environment = :environment', { environment });
    const stale = new Date(Date.now() - 10 * 60_000);
    if (attention) qb.andWhere(`(s.status IN ('CREATING','APPROVAL_PENDING','APPROVED','SUSPENDED')
      OR (s.status = 'ACTIVE' AND (s.paidUntil IS NULL OR s.paidUntil <= :now))
      OR (s.status NOT IN ('CANCELLED','EXPIRED') AND (s.syncedAt IS NULL OR s.syncedAt < :stale))
      OR EXISTS (SELECT 1 FROM paypal_payments p WHERE p.subscriptionKey = s.id AND p.reversed = 0 AND p.confirmationEmailAttemptedAt IS NOT NULL AND p.confirmationEmailSentAt IS NULL)
      OR EXISTS (SELECT 1 FROM paypal_admin_actions a WHERE a.subscriptionKey = s.id AND a.outcome = 'FAILED' AND a.id = (SELECT MAX(b.id) FROM paypal_admin_actions b WHERE b.subscriptionKey = s.id)))`, { now: new Date(), stale });
    const [rows, total] = await qb.orderBy('s.createdAt', 'DESC').addOrderBy('s.id', 'DESC').skip((page - 1) * 25).take(25).getManyAndCount();
    return { items: rows.map(s => this.summary(s)), total, page, pageSize: 25, configuredEnvironment: this.api.environment };
  }

  private summary(s: PaypalSubscription) {
    const u = s.user;
    return { id: s.id, userId: s.userId, paypalId: s.paypalId, environment: s.environment, status: s.status,
      paidUntil: s.paidUntil, syncedAt: s.syncedAt, createdAt: s.createdAt,
      current: !!u && u.billingProvider === 'paypal' && u.paypalSubscriptionId === s.paypalId,
      user: u ? { id: u.id, email: u.email, fullName: u.fullName, plan: u.subscriptionPlan,
        status: u.subscriptionStatus, endsAt: u.subscriptionEndsAt, provider: u.billingProvider } : null,
      canRefresh: !!s.paypalId && s.environment === this.api.environment && this.api.configured };
  }

  async detail(id: string) {
    const s = await this.db.getRepository(PaypalSubscription).findOne({ where: { id }, relations: { user: true } });
    if (!s) throw new NotFoundException('Abonnement introuvable.');
    const [payments, paymentCount] = await this.db.getRepository(PaypalPayment).findAndCount({ where: { subscriptionKey: id }, order: { paidAt: 'DESC', id: 'DESC' }, take: 100 });
    const [actions, actionCount] = await this.db.getRepository(PaypalAdminAction).findAndCount({ where: { subscriptionKey: id }, order: { id: 'DESC' }, take: 100 });
    return { ...this.summary(s), payments: payments.map(p => ({ id: p.id, paidAt: p.paidAt, periodEnd: p.periodEnd,
      reversed: p.reversed, amount: p.paidAt && p.periodEnd ? '3.99' : null, currency: 'EUR',
      emailStatus: p.confirmationEmailSentAt ? 'SENT' : p.confirmationEmailAttemptedAt ? 'CHECK' : p.reversed ? 'NOT_APPLICABLE' : 'PENDING',
      emailSentAt: p.confirmationEmailSentAt })), paymentCount, actions, actionCount };
  }

  async refresh(id: string, actorId: number) {
    const record = await this.db.getRepository(PaypalSubscription).findOneBy({ id });
    if (!record) throw new NotFoundException('Abonnement introuvable.');
    if (!record.paypalId || record.environment !== this.api.environment) throw new BadRequestException('Vérification indisponible pour cet abonnement ou cet environnement.');
    const audit = this.db.getRepository(PaypalAdminAction);
    // Persist intent before contacting PayPal; a crash leaves a visible STARTED action.
    const action = await audit.save(audit.create({ subscriptionKey: id, actorId, outcome: 'STARTED' }));
    try {
      await this.paypal.refreshSubscription(id);
    } catch {
      await audit.update(action.id, { outcome: 'FAILED' });
      throw new ServiceUnavailableException('La vérification PayPal a échoué. Réessaie plus tard ; cette tentative est enregistrée.');
    }
    await audit.update(action.id, { outcome: 'SUCCESS' });
    return this.detail(id);
  }
}
