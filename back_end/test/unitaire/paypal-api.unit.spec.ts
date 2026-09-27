import { ConfigService } from '@nestjs/config';
import { PaypalApiService } from '../../src/billing/paypal/paypal-api.service';

describe('PayPal API boundary', () => {
  let api: PaypalApiService;
  let network: jest.SpyInstance;
  const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response;
  beforeEach(() => {
    api = new PaypalApiService(new ConfigService({ PAYPAL_ENV: 'sandbox', PAYPAL_ENABLED: 'true',
      PAYPAL_CLIENT_ID: 'client', PAYPAL_CLIENT_SECRET: 'never-expose-this', PAYPAL_PLAN_PREMIUM: 'P-TEST', PAYPAL_WEBHOOK_ID: 'WH-TEST' }));
    network = jest.spyOn(global, 'fetch');
  });
  afterEach(() => jest.restoreAllMocks());
  it('authenticates once, uses a fixed PayPal host and reuses the token', async () => {
    network.mockResolvedValueOnce(response({ access_token: 'token', expires_in: 3600 }))
      .mockResolvedValue(response({ status: 'ACTIVE' }));
    await api.request('/v1/billing/subscriptions/I-TEST');
    await api.request('/v1/billing/subscriptions/I-TEST');
    expect(network).toHaveBeenCalledTimes(3);
    expect(network.mock.calls[0][0]).toBe('https://api-m.sandbox.paypal.com/v1/oauth2/token');
    expect(network.mock.calls[1][1].headers.Authorization).toBe('Bearer token');
  });
  it('rejects missing webhook headers without network access', async () => {
    await expect(api.verifyWebhook({}, {})).rejects.toThrow('manquante');
    expect(network).not.toHaveBeenCalled();
  });
  it.each(['FAILURE', undefined])('rejects failed signature verification %s', async (verification_status) => {
    network.mockResolvedValueOnce(response({ access_token: 'token', expires_in: 3600 }))
      .mockResolvedValue(response({ verification_status }));
    await expect(api.verifyWebhook({ 'paypal-transmission-id': 'id', 'paypal-transmission-time': 'time',
      'paypal-transmission-sig': 'sig', 'paypal-cert-url': 'url', 'paypal-auth-algo': 'algo' }, {})).rejects.toThrow('invalide');
  });
  it('sends the configured webhook ID and the entire event for verification', async () => {
    network.mockResolvedValueOnce(response({ access_token: 'token', expires_in: 3600 }))
      .mockResolvedValue(response({ verification_status: 'SUCCESS' }));
    const event = { id: 'WH-EVENT', resource: { id: 'I-TEST' } };
    await api.verifyWebhook({ 'paypal-transmission-id': 'id', 'paypal-transmission-time': 'time',
      'paypal-transmission-sig': 'sig', 'paypal-cert-url': 'url', 'paypal-auth-algo': 'algo' }, event);
    expect(JSON.parse(network.mock.calls[1][1].body)).toMatchObject({ webhook_id: 'WH-TEST', webhook_event: event });
  });
  it('does not disclose provider response bodies or secrets on error', async () => {
    network.mockResolvedValue(response({ secret: 'never-expose-this' }, 401));
    await expect(api.request('/v1/billing/plans/P-TEST')).rejects.toThrow('HTTP 401');
  });
  it.each(['https://evil.example/pay', 'javascript:alert(1)', 'https://www.paypal.com/approve'])('rejects wrong-environment or hostile approval URL %s', (url) => {
    expect(() => api.approvalUrl(url)).toThrow();
  });
  it('keeps checkout disabled without configuration', () => {
    const disabled = new PaypalApiService(new ConfigService({}));
    expect(disabled.ready).toBe(false);
    expect(() => disabled.requireReady()).toThrow();
  });
});
