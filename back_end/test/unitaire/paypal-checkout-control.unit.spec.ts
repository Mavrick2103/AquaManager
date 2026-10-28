import { PaypalAdminService } from '../../src/billing/paypal/paypal-admin.service';

describe('PayPal checkout switch', () => {
  it('persists the switch and actor and reads it from a new service instance', async () => {
    let setting = { id: 1, enabled: true, updatedBy: null, updatedAt: null };
    const db: any = { manager: {
      findOneBy: jest.fn(async () => setting),
      upsert: jest.fn(async (_entity, value) => { setting = value; }),
    } };
    const api: any = { ready: true };
    const service = new PaypalAdminService(db, {} as any, api);
    expect(await service.setCheckoutControl(false, 42)).toMatchObject({ enabled: false, available: true });
    expect(setting.updatedBy).toBe(42);
    const restarted = new PaypalAdminService(db, {} as any, api);
    expect(await restarted.checkoutControl()).toMatchObject({ enabled: false });
    expect(await restarted.setCheckoutControl(true, 42)).toMatchObject({ enabled: true });
    api.ready = false;
    expect(await restarted.checkoutControl()).toMatchObject({ enabled: true, available: false });
    await expect(service.setCheckoutControl('false' as any, 42)).rejects.toThrow('invalide');
  });
});
