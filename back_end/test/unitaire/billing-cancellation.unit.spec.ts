import { BillingService } from '../../src/billing/billing.service';

describe('Stripe cancellation', () => {
  it.each([true, false])('cancels with atPeriodEnd=%s without reactivating renewal', async (atPeriodEnd) => {
    const users = { getBillingState: jest.fn().mockResolvedValue({ stripeSubscriptionId: 'sub_test' }), setStripeSubscriptionState: jest.fn() };
    const stripe = { subscriptions: {
      update: jest.fn().mockResolvedValue({ status: 'active', current_period_end: 1800000000 }),
      cancel: jest.fn().mockResolvedValue({ status: 'canceled' }),
    } };
    const service = new BillingService(users as any);
    Object.defineProperty(service, 'stripe', { get: () => stripe });
    await service.cancelMySubscription(1, atPeriodEnd);
    if (atPeriodEnd) {
      expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_test', { cancel_at_period_end: true });
      expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
    } else {
      expect(stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_test');
      expect(stripe.subscriptions.update).not.toHaveBeenCalled();
      expect(users.setStripeSubscriptionState).toHaveBeenCalledWith(1, expect.objectContaining({ subscriptionStatus: 'canceled', plan: 'CLASSIC' }));
    }
  });
});
