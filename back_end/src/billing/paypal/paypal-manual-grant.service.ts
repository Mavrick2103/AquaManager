import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../../users/user.entity';
import { PaypalApiService } from './paypal-api.service';
import { PaypalSubscription } from './paypal-subscription.entity';
import { adminSubscriptionStatus } from './paypal-admin-status';

@Injectable()
export class PaypalManualGrantService {
  constructor(private readonly db: DataSource, private readonly api: PaypalApiService) {}

  async run<T>(userId: number, grant: () => Promise<T>): Promise<T> {
    const runner = this.db.createQueryRunner();
    const lock = `aquamanager:billing:${userId}`;
    let acquired = false;
    try {
      await runner.connect();
      acquired = Number((await runner.query('SELECT GET_LOCK(?, 5) AS acquired', [lock]))[0]?.acquired) === 1;
      if (!acquired) throw new ServiceUnavailableException('Une opération de paiement est en cours. Réessaie dans un instant.');
      const user = await runner.manager.findOneBy(User, { id: userId });
      if (!user) throw new NotFoundException('Utilisateur introuvable.');
      if (user.paypalRenewalActive) {
        const local = user.paypalSubscriptionId && await runner.manager.findOneBy(PaypalSubscription, { userId, paypalId: user.paypalSubscriptionId });
        if (!local || user.billingProvider !== 'paypal' || local.environment !== this.api.environment
          || adminSubscriptionStatus(local) !== 'ABANDONED') {
          throw new ConflictException('Résilie d’abord l’abonnement PayPal pour attribuer une offre manuellement.');
        }
        const path = `/v1/billing/subscriptions/${encodeURIComponent(local.paypalId!)}`;
        const check = (remote: any) => {
          if (remote.id !== local.paypalId || remote.custom_id !== local.id || remote.plan_id !== local.planId) {
            throw new ConflictException('La tentative PayPal ne correspond pas à ce compte.');
          }
        };
        let remote = await this.api.request(path);
        check(remote);
        if (remote.status === 'APPROVAL_PENDING') {
          await this.api.request(`${path}/cancel`, 'POST', { reason: 'Tentative non validée après 24 h, remplacée par une offre administrateur.' });
          remote = await this.api.request(path);
          check(remote);
        }
        if (!['CANCELLED', 'EXPIRED'].includes(remote.status)) {
          throw new ConflictException('PayPal ne confirme pas l’annulation de cette tentative. Vérifie son état avant d’attribuer une offre.');
        }
        await runner.manager.transaction(async tx => {
          await tx.update(PaypalSubscription, local.id, { status: remote.status, approvalUrl: null, syncedAt: new Date() });
          await tx.update(User, userId, { paypalRenewalActive: false });
        });
      }
      // Keep the shared billing lock until the manual grant is persisted.
      return await grant();
    } finally {
      try { if (acquired) await runner.query('SELECT RELEASE_LOCK(?)', [lock]); }
      finally { await runner.release(); }
    }
  }
}
