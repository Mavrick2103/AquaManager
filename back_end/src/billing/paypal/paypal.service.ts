import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { User } from '../../users/user.entity';
import { MailService } from '../../mail/mail.service';
import { BillingService } from '../billing.service';
import { PaypalApiService } from './paypal-api.service';
import { PaypalPayment, PaypalSubscription } from './paypal-subscription.entity';
import { assertPremiumPlan, hasPaidAccess, isPremiumPrice, paymentPeriodEnd, PAYPAL_EVENTS, TERMINAL_STATUSES, validDate } from './paypal-policy';

@Injectable()
export class PaypalService {
  private readonly logger = new Logger(PaypalService.name);
  private reconciling = false;
  constructor(private readonly db: DataSource, private readonly api: PaypalApiService, private readonly stripe: BillingService, private readonly mail: MailService) {}

  private async locked<T>(userId: number, work: (manager: EntityManager) => Promise<T>): Promise<T> {
    const runner = this.db.createQueryRunner();
    const lock = `aquamanager:billing:${userId}`;
    let acquired = false;
    try {
      await runner.connect();
      acquired = Number((await runner.query('SELECT GET_LOCK(?, 5) AS acquired', [lock]))[0]?.acquired) === 1;
      if (!acquired) throw new ServiceUnavailableException('Une opération de paiement est en cours. Réessaie dans un instant.');
      return await work(runner.manager);
    } finally {
      try { if (acquired) await runner.query('SELECT RELEASE_LOCK(?)', [lock]); }
      finally { await runner.release(); }
    }
  }

  async checkout(userId: number) {
    this.api.requireReady();
    return this.locked(userId, async (manager) => {
      const user = await manager.findOneBy(User, { id: userId });
      if (!user) throw new NotFoundException('Compte introuvable.');
      if (!user.emailVerifiedAt) throw new BadRequestException('Vérifie ton adresse email avant de t’abonner.');
      let local = await manager.findOne(PaypalSubscription, { where: { userId }, order: { createdAt: 'DESC' } });
      if (local && local.environment !== this.api.environment) {
        throw new ConflictException('Ce compte est lié à un autre environnement PayPal. Utilise un compte de test distinct.');
      }
      if (local?.paypalId) {
        await this.sync(manager, local);
        if (local.status === 'APPROVAL_PENDING' && local.approvalUrl) return { url: this.api.approvalUrl(local.approvalUrl) };
        if (!TERMINAL_STATUSES.has(local.status) || hasPaidAccess(local.paidUntil)) {
          throw new ConflictException('Un abonnement PayPal existe déjà. Consulte ton profil pour le gérer.');
        }
        local = null;
      }
      const fresh = await manager.findOneByOrFail(User, { id: userId });
      if ((fresh.subscriptionStatus === 'active' || fresh.subscriptionStatus === 'trialing')
          && (!fresh.subscriptionEndsAt || hasPaidAccess(fresh.subscriptionEndsAt))) {
        throw new ConflictException('Tu bénéficies déjà d’un abonnement actif.');
      }
      await this.stripe.assertNoRecurringSubscription(fresh.stripeSubscriptionId);
      assertPremiumPlan(await this.api.request(`/v1/billing/plans/${encodeURIComponent(this.api.planId)}`));
      if (!local) {
        local = manager.create(PaypalSubscription, {
          id: randomUUID(), userId, paypalId: null, planId: this.api.planId,
          environment: this.api.environment, status: 'CREATING', approvalUrl: null, paidUntil: null, syncedAt: null,
        });
        await manager.transaction(async (tx) => {
          await tx.save(local!);
          await tx.update(User, userId, { billingProvider: 'paypal', paypalSubscriptionId: null, paypalRenewalActive: true });
        });
      }
      // PayPal only retains request IDs for 72 hours. Never risk a second charge after an ambiguous timeout.
      if (Date.now() - local.createdAt.getTime() > 70 * 3_600_000) {
        throw new ConflictException('Cette tentative de paiement doit être vérifiée par le support avant de recommencer.');
      }
      const subscription = await this.api.request('/v1/billing/subscriptions', 'POST', {
        plan_id: local.planId, custom_id: local.id, quantity: '1',
        // Do not combine unpaid months into a later charge: access follows individual 3.99 EUR payments.
        plan: { payment_preferences: { auto_bill_outstanding: false, payment_failure_threshold: 1 } },
        application_context: {
          brand_name: 'AquaManager', locale: 'fr-FR', shipping_preference: 'NO_SHIPPING', user_action: 'SUBSCRIBE_NOW',
          return_url: `${this.api.appUrl}/profile?paypal=return`, cancel_url: `${this.api.appUrl}/profile?paypal=cancel`,
        },
      }, local.id);
      if (!/^I-[A-Z0-9]+$/.test(subscription.id ?? '')) throw new ServiceUnavailableException('Réponse PayPal incomplète.');
      local.paypalId = subscription.id;
      local.status = subscription.status;
      local.approvalUrl = subscription.links?.find((link: any) => link.rel === 'approve')?.href ?? null;
      await manager.transaction(async (tx) => {
        await tx.save(local!);
        await tx.update(User, userId, { paypalSubscriptionId: local!.paypalId });
      });
      if (!local.approvalUrl) throw new ServiceUnavailableException('Le lien de validation PayPal est indisponible.');
      return { url: this.api.approvalUrl(local.approvalUrl) };
    });
  }

  async status(userId: number) {
    const user = await this.db.manager.findOneBy(User, { id: userId });
    if (!user) throw new NotFoundException();
    const local = await this.db.manager.findOne(PaypalSubscription, { where: { userId }, order: { createdAt: 'DESC' } });
    return {
      ready: this.api.ready, provider: user.billingProvider ?? (user.stripeSubscriptionId ? 'stripe' : null),
      status: local?.status ?? null, paidUntil: local?.paidUntil ?? null,
      canCancel: user.billingProvider === 'paypal' && !!local?.paypalId && ['ACTIVE', 'SUSPENDED'].includes(local.status),
      premium: ['PREMIUM', 'PRO'].includes(user.subscriptionPlan)
        && ['active', 'trialing'].includes(user.subscriptionStatus)
        && (!user.subscriptionEndsAt || hasPaidAccess(user.subscriptionEndsAt)),
    };
  }

  async refresh(userId: number) {
    await this.locked(userId, async (manager) => {
      const local = await manager.findOne(PaypalSubscription, { where: { userId }, order: { createdAt: 'DESC' } });
      if (local?.paypalId) await this.sync(manager, local);
    });
    return this.status(userId);
  }

  async refreshSubscription(id: string): Promise<void> {
    const record = await this.db.manager.findOneBy(PaypalSubscription, { id });
    if (!record?.paypalId) throw new NotFoundException('Abonnement PayPal introuvable.');
    await this.locked(record.userId, async manager => {
      const current = await manager.findOneByOrFail(PaypalSubscription, { id });
      await this.sync(manager, current);
    });
  }

  async cancel(userId: number) {
    await this.locked(userId, async (manager) => {
      const local = await manager.findOne(PaypalSubscription, { where: { userId }, order: { createdAt: 'DESC' } });
      if (!local?.paypalId) throw new NotFoundException('Aucun abonnement PayPal à résilier.');
      await this.sync(manager, local);
      if (['APPROVAL_PENDING', 'APPROVED'].includes(local.status)) {
        throw new BadRequestException('Cet abonnement n’est pas encore activé. Tu peux reprendre la validation du paiement depuis ton profil.');
      }
      if (!TERMINAL_STATUSES.has(local.status)) {
        await this.api.request(`/v1/billing/subscriptions/${local.paypalId}/cancel`, 'POST', { reason: 'Résiliation demandée par le titulaire depuis AquaManager.' });
        await this.sync(manager, local);
      }
    });
    return this.status(userId);
  }

  private async sync(manager: EntityManager, local: PaypalSubscription, reversalId?: string) {
    if (local.environment !== this.api.environment) throw new ConflictException('Environnement PayPal incompatible.');
    const remote = await this.api.request(`/v1/billing/subscriptions/${local.paypalId}`);
    if (remote.id !== local.paypalId || remote.plan_id !== local.planId || remote.custom_id !== local.id
        || Number(remote.quantity ?? 1) !== 1) throw new BadRequestException('Abonnement PayPal non reconnu pour ce compte.');
    const start = validDate(remote.start_time);
    const now = new Date();
    const since = new Date(now.getTime() - 31 * 86_400_000);
    // PayPal returns 404 for the transaction history before buyer approval.
    const txs = ['APPROVAL_PENDING', 'APPROVED'].includes(remote.status)
      ? { transactions: [] }
      : await this.api.request(`/v1/billing/subscriptions/${local.paypalId}/transactions?start_time=${since.toISOString()}&end_time=${now.toISOString()}`);
    // Sandbox can return {} while the first payment is still becoming available.
    // It provides no proof of payment: only previously verified payments retain access.
    if (txs && !Array.isArray(txs) && Object.keys(txs).length === 0) txs.transactions = [];
    if (!txs || !Array.isArray(txs.transactions) || Number(txs.total_pages ?? 1) > 1) {
      throw new ServiceUnavailableException('Historique PayPal incomplet. Aucune modification des droits.');
    }
    await manager.transaction(async (tx) => {
      for (const sale of txs.transactions) {
        if (typeof sale.id !== 'string' || !/^[A-Z0-9]+$/.test(sale.id)) continue;
        const paidAt = validDate(sale.time);
        const reversed = ['REFUNDED', 'PARTIALLY_REFUNDED', 'REVERSED'].includes(sale.status);
        const existing = await tx.findOneBy(PaypalPayment, { id: sale.id });
        if (existing && existing.subscriptionKey !== local.id) throw new BadRequestException('Transaction déjà affectée.');
        if (reversed) {
          await tx.save(PaypalPayment, { id: sale.id, subscriptionKey: local.id, paidAt: existing?.paidAt ?? paidAt,
            periodEnd: existing?.periodEnd ?? null, reversed: true });
        } else if (sale.status === 'COMPLETED' && !existing?.reversed && start && paidAt
            && paidAt <= now && isPremiumPrice(sale.amount_with_breakdown?.gross_amount)) {
          await tx.save(PaypalPayment, { id: sale.id, subscriptionKey: local.id, paidAt,
            periodEnd: paymentPeriodEnd(start, paidAt), reversed: false });
        }
      }
      if (reversalId) {
        const existing = await tx.findOneBy(PaypalPayment, { id: reversalId });
        if (existing && existing.subscriptionKey !== local.id) throw new BadRequestException('Remboursement non reconnu.');
        await tx.save(PaypalPayment, { id: reversalId, subscriptionKey: local.id,
          paidAt: existing?.paidAt ?? null, periodEnd: existing?.periodEnd ?? null, reversed: true });
      }
      const payments = await tx.find(PaypalPayment, { where: { subscriptionKey: local.id, reversed: false } });
      local.paidUntil = payments.reduce<Date | null>((end, payment) =>
        payment.periodEnd && (!end || payment.periodEnd > end) ? payment.periodEnd : end, null);
      local.status = remote.status;
      local.syncedAt = now;
      await tx.save(local);
      const user = await tx.findOneBy(User, { id: local.userId });
      // Old events cannot overwrite a later subscription or an administrator's replacement grant.
      if (user?.billingProvider === 'paypal' && user.paypalSubscriptionId === local.paypalId) {
        const paid = hasPaidAccess(local.paidUntil, now);
        await tx.update(User, user.id, {
          subscriptionPlan: paid ? 'PREMIUM' : 'CLASSIC',
          subscriptionStatus: paid ? 'active' : TERMINAL_STATUSES.has(local.status) ? 'canceled' : 'incomplete',
          subscriptionEndsAt: local.paidUntil ?? now,
          paypalRenewalActive: !TERMINAL_STATUSES.has(local.status),
        });
      }
    });
    await this.sendPaymentConfirmations(manager, local);
  }

  private async sendPaymentConfirmations(manager: EntityManager, local: PaypalSubscription): Promise<void> {
    const user = await manager.findOneBy(User, { id: local.userId });
    if (!user?.emailVerifiedAt || user.billingProvider !== 'paypal' || user.paypalSubscriptionId !== local.paypalId) return;
    const payments = await manager.find(PaypalPayment, { where: { subscriptionKey: local.id, reversed: false } });
    for (const payment of payments) {
      if (payment.confirmationEmailAttemptedAt || !hasPaidAccess(payment.periodEnd)) continue;
      // Called under the per-user DB lock, after the entitlement transaction commits.
      // Claim before SMTP: a repeated webhook/refresh cannot send the same confirmation again.
      await manager.update(PaypalPayment, payment.id, { confirmationEmailAttemptedAt: new Date() });
      try {
        await this.mail.sendPremiumPaymentConfirmation(user.email, user.fullName, payment.id, payment.periodEnd!, local.environment === 'sandbox');
        await manager.update(PaypalPayment, payment.id, { confirmationEmailSentAt: new Date() });
      } catch {
        // An SMTP timeout can mean delivery succeeded. Do not automatically resend ambiguous attempts.
        this.logger.warn(`Confirmation de paiement à vérifier : ${payment.id}`);
      }
    }
  }

  async webhook(headers: Record<string, any>, event: any) {
    await this.api.verifyWebhook(headers, event);
    if (!PAYPAL_EVENTS.has(event?.event_type)) return { received: true };
    const resource = event.resource ?? {};
    const reversal = ['PAYMENT.SALE.REFUNDED', 'PAYMENT.SALE.REVERSED'].includes(event.event_type);
    const reversalId = reversal ? String(resource.sale_id ?? (event.event_type === 'PAYMENT.SALE.REVERSED' ? resource.id : '') ?? '') : undefined;
    let paypalId = event.event_type.startsWith('BILLING.SUBSCRIPTION.') ? resource.id : resource.billing_agreement_id;
    let local: PaypalSubscription | null = null;
    if (paypalId) local = await this.db.manager.findOneBy(PaypalSubscription, { paypalId });
    if (!local && reversalId) {
      const payment = await this.db.manager.findOneBy(PaypalPayment, { id: reversalId });
      if (payment) local = await this.db.manager.findOneBy(PaypalSubscription, { id: payment.subscriptionKey });
      else {
        const sale = await this.api.request(`/v1/payments/sale/${encodeURIComponent(reversalId)}`);
        paypalId = sale.billing_agreement_id;
        if (paypalId) local = await this.db.manager.findOneBy(PaypalSubscription, { paypalId });
      }
    }
    if (!local && resource.custom_id) local = await this.db.manager.findOneBy(PaypalSubscription, { id: resource.custom_id });
    if (!local?.paypalId || (reversal && !reversalId)) {
      // A webhook can race the checkout response. Return a failure so PayPal retries.
      throw new ServiceUnavailableException('Paiement PayPal en attente de rapprochement.');
    }
    await this.locked(local.userId, async (manager) => {
      const current = await manager.findOneByOrFail(PaypalSubscription, { id: local!.id });
      await this.sync(manager, current, reversalId);
    });
    return { received: true };
  }

  @Cron('15 * * * *')
  async reconcile(): Promise<void> {
    // Continue managing existing customers even if new checkout is disabled.
    if (!this.api.configured || this.reconciling) return;
    this.reconciling = true;
    try {
      let cursor = '';
      while (true) {
        const batch = await this.db.getRepository(PaypalSubscription).createQueryBuilder('s')
          .where('s.environment = :env AND s.paypalId IS NOT NULL AND s.id > :cursor', { env: this.api.environment, cursor })
          .andWhere('(s.status NOT IN (:...terminal) OR s.paidUntil > :now)', { terminal: [...TERMINAL_STATUSES], now: new Date() })
          .orderBy('s.id', 'ASC').take(50).getMany();
        if (!batch.length) break;
        for (const record of batch) {
          try {
            await this.locked(record.userId, async (manager) => this.sync(manager, await manager.findOneByOrFail(PaypalSubscription, { id: record.id })));
          } catch { this.logger.warn(`Synchronisation PayPal à réessayer pour ${record.id}`); }
        }
        cursor = batch[batch.length - 1].id;
      }
    } catch { this.logger.error('Synchronisation PayPal indisponible. Vérifier la configuration et les migrations.'); }
    finally { this.reconciling = false; }
  }
}
