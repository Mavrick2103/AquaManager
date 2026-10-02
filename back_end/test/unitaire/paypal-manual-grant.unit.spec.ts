import { PaypalManualGrantService } from '../../src/billing/paypal/paypal-manual-grant.service';
import { User } from '../../src/users/user.entity';
import { PaypalApiError } from '../../src/billing/paypal/paypal-api.service';

describe('Manual grant after an abandoned PayPal checkout', () => {
  function setup(status = 'APPROVAL_PENDING') {
    const user = { id: 1, billingProvider: 'paypal', paypalSubscriptionId: 'I-TEST', paypalRenewalActive: true };
    const local = { id: 'key', userId: 1, paypalId: 'I-TEST', planId: 'P-TEST', environment: 'live', status: 'APPROVAL_PENDING', paidUntil: null, createdAt: new Date(Date.now() - 25 * 3600000) };
    const remote = { id: 'I-TEST', custom_id: 'key', plan_id: 'P-TEST', status };
    const manager: any = {
      findOneBy: jest.fn(async entity => entity === User ? user : local),
      countBy: jest.fn(async () => 0),
      update: jest.fn(async (entity, id, patch) => Object.assign(entity === User ? user : local, patch)),
      transaction: jest.fn(async cb => cb(manager)),
    };
    const runner = { manager, connect: jest.fn(), release: jest.fn(), query: jest.fn(async () => [{ acquired: 1 }]) };
    const api = { environment: 'live', request: jest.fn(async (path: string, method?: string) => {
      if (method === 'POST') remote.status = 'CANCELLED';
      return { ...remote };
    }) };
    const grant = jest.fn(async () => { expect(user.paypalRenewalActive).toBe(false); return 'granted'; });
    const service = new PaypalManualGrantService({ createQueryRunner: () => runner } as any, api as any);
    return { service, runner, user, local, remote, api, grant };
  }
  it('confirms cancellation before granting and retains the billing lock throughout', async () => {
    const { service, grant, api, runner, local } = setup();
    expect(await service.run(1, grant)).toBe('granted');
    expect(api.request.mock.calls.map(call => call[1] ?? 'GET')).toEqual(['GET', 'POST', 'GET']);
    expect(local.status).toBe('CANCELLED');
    expect(grant.mock.invocationCallOrder[0]).toBeLessThan(runner.query.mock.invocationCallOrder[1]);
    expect(runner.release).toHaveBeenCalled();
  });
  it('allows a separate gift on a read 404 without declaring the PayPal attempt cancelled', async () => {
    const { service, api, user, local, runner } = setup();
    api.request.mockRejectedValue(new PaypalApiError('Not found', 404, '/v1/billing/subscriptions/I-TEST', 'GET'));
    const grant = jest.fn(async () => 'gift');
    expect(await service.run(1, grant)).toBe('gift');
    expect(local.status).toBe('APPROVAL_PENDING');
    expect(user.paypalRenewalActive).toBe(true);
    expect(user.paypalSubscriptionId).toBe('I-TEST');
    expect(runner.manager.update).not.toHaveBeenCalled();
    expect(api.request).toHaveBeenCalledTimes(1);
  });
  it.each([
    [404, '/v1/oauth2/token', 'POST'],
    [404, '/v1/billing/subscriptions/I-TEST/cancel', 'POST'],
    [403, '/v1/billing/subscriptions/I-TEST', 'GET'],
    [500, '/v1/billing/subscriptions/I-TEST', 'GET'],
  ])('does not bypass unrelated provider errors (%s %s)', async (status, path, method) => {
    const { service, api, grant } = setup();
    api.request.mockRejectedValue(new PaypalApiError('Error', status as number, path as string, method as string));
    await expect(service.run(1, grant)).rejects.toThrow();
    expect(grant).not.toHaveBeenCalled();
  });
  it('refuses a read 404 when any payment has been recorded', async () => {
    const { service, api, grant, runner } = setup();
    runner.manager.countBy.mockResolvedValue(1);
    api.request.mockRejectedValue(new PaypalApiError('Not found', 404, '/v1/billing/subscriptions/I-TEST', 'GET'));
    await expect(service.run(1, grant)).rejects.toThrow();
    expect(grant).not.toHaveBeenCalled();
  });
  it.each(['ACTIVE', 'APPROVED', 'SUSPENDED'])('does not cancel or override a remote %s subscription', async status => {
    const { service, grant, api, user } = setup(status);
    await expect(service.run(1, grant)).rejects.toThrow('annulation');
    expect(api.request).toHaveBeenCalledTimes(1);
    expect(grant).not.toHaveBeenCalled();
    expect(user.paypalRenewalActive).toBe(true);
  });
  it('leaves recent attempts and recorded paid periods protected', async () => {
    const { service, grant, local, api } = setup();
    local.createdAt = new Date();
    await expect(service.run(1, grant)).rejects.toThrow('Résilie');
    expect(api.request).not.toHaveBeenCalled();
    expect(grant).not.toHaveBeenCalled();
  });
  it('never grants on a PayPal failure and releases the lock', async () => {
    const { service, grant, api, runner, user } = setup();
    api.request.mockRejectedValue(new Error('PayPal unavailable'));
    await expect(service.run(1, grant)).rejects.toThrow();
    expect(grant).not.toHaveBeenCalled();
    expect(user.paypalRenewalActive).toBe(true);
    expect(runner.release).toHaveBeenCalled();
  });
  it('requires confirmed cancellation rather than trusting the cancel response', async () => {
    const { service, grant, api, remote } = setup();
    api.request.mockImplementation(async () => ({ ...remote }));
    await expect(service.run(1, grant)).rejects.toThrow('annulation');
    expect(grant).not.toHaveBeenCalled();
  });
  it('can retry after remote cancellation succeeded but the grant did not', async () => {
    const { service, grant, api } = setup('CANCELLED');
    expect(await service.run(1, grant)).toBe('granted');
    expect(api.request).toHaveBeenCalledTimes(1);
  });
});
