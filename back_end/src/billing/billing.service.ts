import { ConflictException, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import Stripe from 'stripe';
import { UsersService } from '../users/users.service';
import type { SubscriptionPlan } from '../users/user.entity';

type SubStatus = 'none' | 'active' | 'trialing' | 'canceled' | 'past_due' | 'incomplete';

function mapStripeStatus(status?: string | null): SubStatus {
  const s = String(status ?? '').toLowerCase();
  if (s === 'active') return 'active';
  if (s === 'trialing') return 'trialing';
  if (s === 'past_due') return 'past_due';
  if (s === 'incomplete') return 'incomplete';
  if (s === 'canceled') return 'canceled';
  return 'none';
}

function isPremiumAllowed(status: SubStatus): boolean {
  return status === 'active' || status === 'trialing';
}

function unwrapStripeResponse<T>(res: any): T {
  // stripe@22 peut renvoyer Response<T> => { data: T, ... }
  return res && typeof res === 'object' && 'data' in res ? (res.data as T) : (res as T);
}

@Injectable()
export class BillingService {
  private readonly stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  constructor(private readonly usersService: UsersService) {}

  async createCheckoutSession(userId: number) {
    if (!Number.isFinite(userId)) throw new BadRequestException('Invalid userId');

    // ✅ blocage si déjà abonné
    const state = await this.usersService.getBillingState(userId);
    const currentStatus = mapStripeStatus(state?.subscriptionStatus);

    if (currentStatus === 'active' || currentStatus === 'trialing') {
      throw new ConflictException('Tu as déjà un abonnement actif.');
    }

    const priceId = process.env.STRIPE_PRICE_PREMIUM!;
    const successUrl = process.env.STRIPE_SUCCESS_URL!;
    const cancelUrl = process.env.STRIPE_CANCEL_URL!;

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,

      // ✅ si on a déjà un customer Stripe, on le réutilise
      ...(state?.stripeCustomerId ? { customer: state.stripeCustomerId } : {}),

      // strings only
      metadata: { userId: String(userId), plan: 'PREMIUM' },
    });

    return { url: session.url };
  }

  /**
   * ✅ Stripe Customer Portal : le user peut résilier lui-même.
   * IMPORTANT: côté Stripe Dashboard, active le Customer Portal et autorise "Cancel subscription".
   */
  async createCustomerPortalSession(userId: number) {
    if (!Number.isFinite(userId)) throw new BadRequestException('Invalid userId');

    const state = await this.usersService.getBillingState(userId);
    if (!state?.stripeCustomerId) {
      throw new NotFoundException("Aucun customer Stripe pour cet utilisateur (pas encore abonné).");
    }

    const returnUrl =
      process.env.STRIPE_PORTAL_RETURN_URL ||
      process.env.APP_URL ||
      'http://localhost:4200/profile';

    const portal = await this.stripe.billingPortal.sessions.create({
      customer: state.stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: portal.url };
  }

  /**
   * ✅ OPTIONNEL : résiliation depuis ton app (sans portail)
   * cancelAtPeriodEnd = true => résilie en fin de période payée
   * cancelAtPeriodEnd = false => résilie immédiatement (attention UX)
   */
  async cancelMySubscription(userId: number, cancelAtPeriodEnd = true) {
    if (!Number.isFinite(userId)) throw new BadRequestException('Invalid userId');

    const state = await this.usersService.getBillingState(userId);
    if (!state?.stripeSubscriptionId) {
      throw new NotFoundException("Aucun abonnement Stripe à résilier.");
    }

    const updatedRes = await this.stripe.subscriptions.update(state.stripeSubscriptionId, {
      cancel_at_period_end: cancelAtPeriodEnd,
    });

    const sub = unwrapStripeResponse<any>(updatedRes);

    const status = mapStripeStatus(sub?.status);
    const endsAt = sub?.current_period_end ? new Date(sub.current_period_end * 1000) : null;

    await this.usersService.setStripeSubscriptionState(userId, {
      subscriptionStatus: status,
      subscriptionEndsAt: endsAt,
      plan: isPremiumAllowed(status) ? 'PREMIUM' : 'CLASSIC',
    });

    return { ok: true, cancelAtPeriodEnd, endsAt };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET!;
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, secret) as any;

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;

        const userId = Number(session?.metadata?.userId);
        const plan = (session?.metadata?.plan ?? 'PREMIUM') as SubscriptionPlan;

        if (!Number.isFinite(userId)) return { received: true };

        const stripeCustomerId = (session?.customer ?? null) as string | null;
        const stripeSubscriptionId = (session?.subscription ?? null) as string | null;

        let status: SubStatus = 'none';
        let endsAt: Date | null = null;

        if (stripeSubscriptionId) {
          const subRes = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);
          const sub = unwrapStripeResponse<any>(subRes);

          status = mapStripeStatus(sub?.status);
          endsAt = sub?.current_period_end ? new Date(sub.current_period_end * 1000) : null;
        }

        await this.usersService.setStripeSubscriptionState(userId, {
          plan: isPremiumAllowed(status) ? plan : 'CLASSIC',
          stripeCustomerId,
          stripeSubscriptionId,
          subscriptionStatus: status,
          subscriptionEndsAt: endsAt,
        });

        return { received: true };
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as any;

        const stripeSubscriptionId = String(sub?.id ?? '');
        if (!stripeSubscriptionId) return { received: true };

        const userId = await this.usersService.findUserIdByStripeSubscriptionId(stripeSubscriptionId);
        if (!userId) return { received: true };

        const status = mapStripeStatus(sub?.status);
        const endsAt = sub?.current_period_end ? new Date(sub.current_period_end * 1000) : null;

        await this.usersService.setStripeSubscriptionState(userId, {
          subscriptionStatus: status,
          subscriptionEndsAt: endsAt,
          plan: isPremiumAllowed(status) ? 'PREMIUM' : 'CLASSIC',
        });

        return { received: true };
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as any;

        const stripeSubscriptionId = String(sub?.id ?? '');
        if (!stripeSubscriptionId) return { received: true };

        const userId = await this.usersService.findUserIdByStripeSubscriptionId(stripeSubscriptionId);
        if (!userId) return { received: true };

        await this.usersService.setStripeSubscriptionState(userId, {
          subscriptionStatus: 'canceled',
          subscriptionEndsAt: new Date(),
          plan: 'CLASSIC',
        });

        return { received: true };
      }

      default:
        return { received: true };
    }
  }
}