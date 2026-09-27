import { PaypalService } from '../../src/billing/paypal/paypal.service';
import { PaypalPayment, PaypalSubscription } from '../../src/billing/paypal/paypal-subscription.entity';
import { User } from '../../src/users/user.entity';

const plan = () => ({ status: 'ACTIVE', billing_cycles: [{ tenure_type: 'REGULAR', total_cycles: 0,
  frequency: { interval_unit: 'MONTH', interval_count: 1 }, pricing_scheme: { fixed_price: { currency_code: 'EUR', value: '3.99' } } }] });

describe('PayPal subscription lifecycle (no real network/payments)', () => {
  let service: PaypalService;
  let manager: any;
  let api: any;
  let stripe: any;
  let mail: any;
  let user: any;
  let local: any;
  let remote: any;
  let sales: any[];
  let rows: Map<any, Map<any, any>>;
  let runner: any;

  const sale = (id = 'SALE1', time = '2026-09-26T10:00:00Z') => ({
    id, time, status: 'COMPLETED', amount_with_breakdown: { gross_amount: { currency_code: 'EUR', value: '3.99' } },
  });
  const notify = (type = 'PAYMENT.SALE.COMPLETED', resource: any = { billing_agreement_id: 'I-TEST' }) =>
    service.webhook({}, { id: 'WH-EVENT', event_type: type, resource });

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-26T10:05:00Z'));
    user = { id: 1, email: 'buyer@example.test', fullName: 'Test', emailVerifiedAt: new Date(), subscriptionPlan: 'CLASSIC', subscriptionStatus: 'incomplete',
      billingProvider: 'paypal', paypalSubscriptionId: 'I-TEST', paypalRenewalActive: true };
    local = Object.assign(new PaypalSubscription(), { id: 'local-key', userId: 1, paypalId: 'I-TEST',
      environment: 'sandbox', planId: 'P-PLAN', status: 'APPROVAL_PENDING', paidUntil: null, createdAt: new Date() });
    remote = { id: 'I-TEST', plan_id: 'P-PLAN', custom_id: 'local-key', status: 'ACTIVE', start_time: '2026-09-26T10:00:00Z', quantity: '1' };
    sales = [sale()];
    rows = new Map<any, Map<any, any>>([[User, new Map([[1, user]])], [PaypalSubscription, new Map([['local-key', local]])], [PaypalPayment, new Map()]]);
    const find = (entity, where) => [...rows.get(entity)!.values()].filter((row) => Object.entries(where).every(([key, value]) => row[key] === value));
    manager = {
      findOneBy: jest.fn(async (entity, where) => find(entity, where)[0] ?? null),
      findOneByOrFail: jest.fn(async (entity, where) => { const row = find(entity, where)[0]; if (!row) throw new Error('not found'); return row; }),
      findOne: jest.fn(async (entity, { where }) => find(entity, where).at(-1) ?? null),
      find: jest.fn(async (entity, { where }) => find(entity, where)),
      create: jest.fn((entity, data) => Object.assign(new entity(), { createdAt: new Date() }, data)),
      save: jest.fn(async (first, second?) => {
        const entity = second ? first : first.constructor;
        const value = second ?? first;
        const saved = Object.assign(rows.get(entity)!.get(value.id) ?? new entity(), value);
        rows.get(entity)!.set(value.id, saved); return saved;
      }),
      update: jest.fn(async (entity, id, patch) => { Object.assign(rows.get(entity)!.get(id), patch); }),
      transaction: jest.fn(async (callback) => callback(manager)),
    };
    runner = { manager, connect: jest.fn(), release: jest.fn(), query: jest.fn().mockResolvedValue([{ acquired: 1 }]) };
    api = {
      environment: 'sandbox', planId: 'P-PLAN', appUrl: 'https://test.example.com', ready: true, configured: true,
      requireReady: jest.fn(), approvalUrl: jest.fn((url) => url), verifyWebhook: jest.fn().mockResolvedValue(undefined),
      request: jest.fn(async (path, method, body) => {
        if (path.includes('/plans/')) return plan();
        if (path.includes('/transactions?')) return { transactions: sales, total_pages: 1 };
        if (path.endsWith('/cancel')) { remote.status = 'CANCELLED'; return {}; }
        if (method === 'POST' && path === '/v1/billing/subscriptions') {
          remote = { ...remote, custom_id: body.custom_id, status: 'APPROVAL_PENDING' };
          return { ...remote, links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/approve' }] };
        }
        return remote;
      }),
    };
    stripe = { assertNoRecurringSubscription: jest.fn().mockResolvedValue(undefined) };
    mail = { sendPremiumPaymentConfirmation: jest.fn().mockResolvedValue(undefined) };
    service = new PaypalService({ manager, createQueryRunner: () => runner } as any, api, stripe, mail);
  });
  afterEach(() => jest.useRealTimers());

  it('activates only from a verified, correctly priced completed payment', async () => {
    await notify();
    expect(api.verifyWebhook).toHaveBeenCalled();
    expect(user.subscriptionPlan).toBe('PREMIUM');
    expect(user.subscriptionEndsAt.toISOString()).toBe('2026-10-26T10:00:00.000Z');
  });
  it('does not activate on approval or ACTIVE alone', async () => {
    sales = [];
    await notify('BILLING.SUBSCRIPTION.ACTIVATED', { id: 'I-TEST' });
    expect(user.subscriptionPlan).toBe('CLASSIC');
  });
  it('waits for a completed payment after an empty PayPal history without granting access early', async () => {
    api.request.mockResolvedValueOnce(remote).mockResolvedValueOnce({});
    const waiting = await service.refresh(1);
    expect(waiting.status).toBe('ACTIVE');
    expect(waiting.premium).toBe(false);
    expect(mail.sendPremiumPaymentConfirmation).not.toHaveBeenCalled();
    const confirmed = await service.refresh(1);
    expect(confirmed.premium).toBe(true);
    expect(mail.sendPremiumPaymentConfirmation).toHaveBeenCalledTimes(1);
  });
  it('preserves previously verified access when PayPal returns an empty history', async () => {
    await service.refresh(1);
    const paidUntil = user.subscriptionEndsAt;
    api.request.mockResolvedValueOnce(remote).mockResolvedValueOnce({});
    expect((await service.refresh(1)).premium).toBe(true);
    expect(user.subscriptionEndsAt).toEqual(paidUntil);
    expect(mail.sendPremiumPaymentConfirmation).toHaveBeenCalledTimes(1);
  });
  it.each([null, [], { transactions: null }, { total_items: 1 }, { transactions: [], total_pages: 2 }])(
    'rejects malformed or partial history %j without changing rights', async (history) => {
      api.request.mockResolvedValueOnce(remote).mockResolvedValueOnce(history);
      await expect(service.refresh(1)).rejects.toThrow('Historique PayPal incomplet');
      expect(manager.update).not.toHaveBeenCalled();
    });
  it('rejects forged webhook signatures before reading or updating billing', async () => {
    api.verifyWebhook.mockRejectedValue(new Error('invalid signature'));
    await expect(notify()).rejects.toThrow('invalid signature');
    expect(api.request).not.toHaveBeenCalled();
    expect(manager.update).not.toHaveBeenCalled();
  });
  it.each(['plan_id', 'custom_id', 'id', 'quantity'])('rejects wrong subscription %s', async (key) => {
    remote[key] = 'wrong';
    await expect(notify()).rejects.toThrow();
    expect(user.subscriptionPlan).toBe('CLASSIC');
  });
  it('does not extend twice for duplicate notifications', async () => {
    await notify(); await notify(); await service.refresh(1);
    expect(rows.get(PaypalPayment)!.size).toBe(1);
    expect(user.subscriptionEndsAt.toISOString()).toBe('2026-10-26T10:00:00.000Z');
    expect(mail.sendPremiumPaymentConfirmation).toHaveBeenCalledTimes(1);
    expect(mail.sendPremiumPaymentConfirmation).toHaveBeenCalledWith('buyer@example.test', 'Test', 'SALE1', expect.any(Date), true);
  });
  it('keeps Premium active if email delivery fails and does not retry an ambiguous send', async () => {
    mail.sendPremiumPaymentConfirmation.mockRejectedValue(new Error('SMTP timeout'));
    await notify(); await service.refresh(1);
    expect(user.subscriptionPlan).toBe('PREMIUM');
    expect(mail.sendPremiumPaymentConfirmation).toHaveBeenCalledTimes(1);
    expect(rows.get(PaypalPayment)!.get('SALE1').confirmationEmailAttemptedAt).toBeDefined();
    expect(rows.get(PaypalPayment)!.get('SALE1').confirmationEmailSentAt).toBeUndefined();
  });
  it('does not email for an unpaid or refunded transaction', async () => {
    sales[0].status = 'PENDING'; await notify();
    sales[0].status = 'REFUNDED'; await notify();
    expect(mail.sendPremiumPaymentConfirmation).not.toHaveBeenCalled();
  });
  it('extends after a real renewal', async () => {
    await notify();
    jest.setSystemTime(new Date('2026-10-26T10:05:00Z'));
    sales = [sale('SALE2', '2026-10-26T10:00:00Z')];
    await notify();
    expect(user.subscriptionEndsAt.toISOString()).toBe('2026-11-26T10:00:00.000Z');
  });
  it.each(['CANCELLED', 'SUSPENDED', 'EXPIRED'])('preserves the paid period on %s', async (status) => {
    await notify(); remote.status = status; await notify('BILLING.SUBSCRIPTION.UPDATED', { id: 'I-TEST' });
    expect(user.subscriptionPlan).toBe('PREMIUM');
    expect(user.subscriptionEndsAt.toISOString()).toBe('2026-10-26T10:00:00.000Z');
  });
  it('revokes a refunded payment and never restores it with an older completed event', async () => {
    await notify();
    await notify('PAYMENT.SALE.REFUNDED', { sale_id: 'SALE1', billing_agreement_id: 'I-TEST' });
    await notify();
    expect(user.subscriptionPlan).toBe('CLASSIC');
    expect(rows.get(PaypalPayment)!.get('SALE1').reversed).toBe(true);
  });
  it('does not revoke a later paid month when an earlier payment is refunded', async () => {
    await notify(); jest.setSystemTime(new Date('2026-10-26T10:05:00Z'));
    sales = [sale('SALE2', '2026-10-26T10:00:00Z')]; await notify();
    await notify('PAYMENT.SALE.REFUNDED', { sale_id: 'SALE1' });
    expect(user.subscriptionEndsAt.toISOString()).toBe('2026-11-26T10:00:00.000Z');
  });
  it.each(['PENDING', 'DENIED'])('does not grant access to a %s payment', async (status) => {
    sales[0].status = status; await notify(); expect(user.subscriptionPlan).toBe('CLASSIC');
  });
  it('rejects payments in another currency or for another amount', async () => {
    sales[0].amount_with_breakdown.gross_amount.value = '0.01'; await notify();
    expect(user.subscriptionPlan).toBe('CLASSIC');
    sales[0].amount_with_breakdown.gross_amount = { currency_code: 'USD', value: '3.99' }; await notify();
    expect(user.subscriptionPlan).toBe('CLASSIC');
  });
  it('expires access after failed renewal', async () => {
    await notify(); jest.setSystemTime(new Date('2026-10-27T10:05:00Z'));
    sales = []; await notify('BILLING.SUBSCRIPTION.PAYMENT.FAILED', { id: 'I-TEST' });
    expect(user.subscriptionPlan).toBe('CLASSIC');
  });
  it('ignores stale lifecycle event data and reads the current PayPal state', async () => {
    remote.status = 'CANCELLED';
    await notify('BILLING.SUBSCRIPTION.ACTIVATED', { id: 'I-TEST', status: 'ACTIVE' });
    expect(local.status).toBe('CANCELLED');
  });
  it('does not overwrite a newer subscription or a manual grant', async () => {
    user.paypalSubscriptionId = 'I-NEW'; user.subscriptionPlan = 'PRO';
    await notify(); expect(user.subscriptionPlan).toBe('PRO');
    user.paypalSubscriptionId = 'I-TEST'; user.billingProvider = null;
    await notify(); expect(user.subscriptionPlan).toBe('PRO');
  });
  it('cannot refresh or cancel another user’s subscription', async () => {
    await expect(service.cancel(2)).rejects.toThrow();
    await expect(service.refresh(2)).rejects.toThrow();
    expect(api.request).not.toHaveBeenCalled();
  });
  it('cancels with PayPal while preserving the paid period', async () => {
    const result = await service.cancel(1);
    expect(result.canCancel).toBe(false);
    expect(result.premium).toBe(true);
    expect(user.paypalRenewalActive).toBe(false);
  });
  it.each(['APPROVAL_PENDING', 'APPROVED'])('refreshes %s without requesting unavailable history', async (status) => {
    remote.status = status;
    const result = await service.refresh(1);
    expect(result.canCancel).toBe(false);
    expect(result.premium).toBe(false);
    expect(api.request.mock.calls.some(([path]) => path.includes('/transactions?'))).toBe(false);
    await expect(service.cancel(1)).rejects.toThrow('pas encore activé');
    expect(api.request.mock.calls.some(([path]) => path.endsWith('/cancel'))).toBe(false);
  });
  it('resumes pending approval without creating a second subscription', async () => {
    remote.status = 'APPROVAL_PENDING';
    local.approvalUrl = 'https://www.sandbox.paypal.com/approve';
    await expect(service.checkout(1)).resolves.toEqual({ url: local.approvalUrl });
    expect(api.request.mock.calls.some(([, method]) => method === 'POST')).toBe(false);
  });
  it('does not mutate entitlements when PayPal is unavailable', async () => {
    api.request.mockRejectedValue(new Error('timeout'));
    await expect(service.refresh(1)).rejects.toThrow();
    expect(manager.update).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
  });
  it('refuses a second active checkout', async () => {
    await expect(service.checkout(1)).rejects.toThrow('existe déjà');
    expect(api.request.mock.calls.some((call) => call[1] === 'POST')).toBe(false);
  });
  it('creates a server-owned subscription with a persistent request key and safe return URL', async () => {
    rows.get(PaypalSubscription)!.clear(); user.billingProvider = null; user.paypalSubscriptionId = null;
    const response = await service.checkout(1);
    expect(response.url).toContain('sandbox.paypal.com');
    const request = api.request.mock.calls.find((call) => call[1] === 'POST');
    expect(request[2].custom_id).toBe(request[3]);
    expect(request[2].plan.payment_preferences).toEqual({ auto_bill_outstanding: false, payment_failure_threshold: 1 });
    expect(request[2].plan_id).toBe('P-PLAN');
    expect(request[2].application_context.return_url).toBe('https://test.example.com/profile?paypal=return');
    expect(user.subscriptionPlan).toBe('CLASSIC');
    expect(user.paypalRenewalActive).toBe(true);
  });
  it('reuses the same request ID after an ambiguous creation timeout', async () => {
    rows.get(PaypalSubscription)!.clear(); user.paypalSubscriptionId = null;
    const original = api.request.getMockImplementation();
    let failed = false;
    api.request.mockImplementation(async (...args) => {
      if (args[1] === 'POST' && !failed) { failed = true; throw new Error('timeout'); }
      return original(...args);
    });
    await expect(service.checkout(1)).rejects.toThrow('timeout');
    await service.checkout(1);
    const requests = api.request.mock.calls.filter((call) => call[1] === 'POST');
    expect(requests[0][3]).toBe(requests[1][3]);
  });
  it('blocks an ambiguous creation older than PayPal’s idempotency retention', async () => {
    local.paypalId = null; local.createdAt = new Date('2026-09-20T00:00:00Z');
    await expect(service.checkout(1)).rejects.toThrow('support');
  });
  it('blocks mixed Sandbox/Live data', async () => {
    api.environment = 'live'; await expect(service.refresh(1)).rejects.toThrow('Environnement');
  });
  it('retries rather than acknowledging unmatched payment webhooks', async () => {
    await expect(notify('PAYMENT.SALE.COMPLETED', { billing_agreement_id: 'I-UNKNOWN' })).rejects.toThrow('rapprochement');
  });
});
