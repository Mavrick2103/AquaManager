import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { RolesGuard } from '../../src/auth/guards/roles.guard';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { PaypalAdminController } from '../../src/billing/paypal/paypal-admin.controller';
import { PaypalAdminService } from '../../src/billing/paypal/paypal-admin.service';
import { PaypalAdminAction } from '../../src/billing/paypal/paypal-admin-action.entity';

describe('PayPal admin access and audit', () => {
  it.each(['USER', 'EDITOR', undefined])('denies role %s for every endpoint', role => {
    const guard = new RolesGuard(new Reflector());
    for (const handler of ['list', 'detail', 'refresh']) {
      const context: any = { getHandler: () => PaypalAdminController.prototype[handler], getClass: () => PaypalAdminController,
        switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }) };
      expect(() => guard.canActivate(context)).toThrow();
    }
  });
  it('requires authentication as well as the ADMIN role', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, PaypalAdminController)).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
    const context: any = { getHandler: () => PaypalAdminController.prototype.list, getClass: () => PaypalAdminController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'ADMIN' } }) }) };
    expect(new RolesGuard(new Reflector()).canActivate(context)).toBe(true);
  });
  function setup(environment = 'sandbox') {
    const audit = { create: jest.fn(x => x), save: jest.fn(async x => ({ ...x, id: 7 })), update: jest.fn() };
    const subscriptions = { findOneBy: jest.fn(async () => ({ id: 'key', paypalId: 'I-TEST', environment })) };
    const paypal = { refreshSubscription: jest.fn() };
    const db: any = { getRepository: jest.fn(entity => entity === PaypalAdminAction ? audit : subscriptions) };
    const service = new PaypalAdminService(db, paypal as any, { environment: 'sandbox', configured: true } as any);
    jest.spyOn(service, 'detail').mockResolvedValue({} as any);
    return { service, paypal, audit, db };
  }
  it('records who requested a successful verification and its target', async () => {
    const { service, audit, paypal } = setup();
    await service.refresh('key', 42);
    expect(audit.create).toHaveBeenCalledWith({ subscriptionKey: 'key', actorId: 42, outcome: 'STARTED' });
    expect(paypal.refreshSubscription).toHaveBeenCalledWith('key');
    expect(audit.save.mock.invocationCallOrder[0]).toBeLessThan(paypal.refreshSubscription.mock.invocationCallOrder[0]);
    expect(audit.update).toHaveBeenCalledWith(7, { outcome: 'SUCCESS' });
  });
  it('records failure without exposing provider errors or secrets', async () => {
    const { service, audit, paypal } = setup();
    paypal.refreshSubscription.mockRejectedValue(new Error('private provider response'));
    await expect(service.refresh('key', 42)).rejects.toThrow('La vérification PayPal a échoué');
    expect(audit.update).toHaveBeenCalledWith(7, { outcome: 'FAILED' });
  });
  it('does not contact PayPal if the audit cannot be persisted', async () => {
    const { service, audit, paypal } = setup();
    audit.save.mockRejectedValue(new Error('database unavailable'));
    await expect(service.refresh('key', 42)).rejects.toThrow();
    expect(paypal.refreshSubscription).not.toHaveBeenCalled();
  });
  it('refuses a cross-environment refresh', async () => {
    const { service, paypal } = setup('live');
    await expect(service.refresh('key', 42)).rejects.toThrow('environnement');
    expect(paypal.refreshSubscription).not.toHaveBeenCalled();
  });
  it.each([0, -1, 1.5, NaN, 100001])('rejects invalid page %s', async page => {
    const { service, db } = setup();
    await expect(service.list('', page)).rejects.toThrow('Filtres invalides');
    expect(db.getRepository).not.toHaveBeenCalled();
  });
});
