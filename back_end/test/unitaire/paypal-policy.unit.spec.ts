import { assertPremiumPlan, hasPaidAccess, isPremiumPrice, paymentPeriodEnd } from '../../src/billing/paypal/paypal-policy';

export const premiumPlan = () => ({ status: 'ACTIVE', billing_cycles: [{
  tenure_type: 'REGULAR', total_cycles: 0, frequency: { interval_unit: 'MONTH', interval_count: 1 },
  pricing_scheme: { fixed_price: { currency_code: 'EUR', value: '3.99' } },
}], payment_preferences: { setup_fee: { currency_code: 'EUR', value: '0.00' } } });

describe('PayPal Premium policy', () => {
  it('accepts only the advertised monthly plan without hidden fees', () => {
    expect(() => assertPremiumPlan(premiumPlan())).not.toThrow();
  });
  it.each([
    (p) => { p.status = 'INACTIVE'; },
    (p) => { p.billing_cycles[0].pricing_scheme.fixed_price.value = '39.99'; },
    (p) => { p.billing_cycles[0].pricing_scheme.fixed_price.currency_code = 'USD'; },
    (p) => { p.billing_cycles[0].frequency.interval_unit = 'YEAR'; },
    (p) => { p.billing_cycles[0].frequency.interval_count = 2; },
    (p) => { p.billing_cycles[0].total_cycles = 12; },
    (p) => { p.billing_cycles.push({ tenure_type: 'TRIAL' }); },
    (p) => { p.payment_preferences.setup_fee.value = '1'; },
    (p) => { p.taxes = { percentage: '20' }; },
    (p) => { p.quantity_supported = true; },
  ])('rejects incompatible plan configuration %#', (mutate) => {
    const plan: any = premiumPlan(); mutate(plan);
    expect(() => assertPremiumPlan(plan)).toThrow();
  });
  it.each(['3.990', '3.99'])('accepts exact monetary value %s', (value) => {
    expect(isPremiumPrice({ value, currency_code: 'EUR' })).toBe(true);
  });
  it.each(['3.99junk', '399', '0.00', '-3.99', '3.999'])('rejects incorrect amount %s', (value) => {
    expect(isPremiumPrice({ value, currency_code: 'EUR' })).toBe(false);
  });
  it.each([
    ['2026-01-31T10:00:00Z', '2026-01-31T10:00:00Z', '2026-02-28T10:00:00.000Z'],
    ['2026-01-31T10:00:00Z', '2026-02-28T10:00:00Z', '2026-03-31T10:00:00.000Z'],
    ['2028-01-31T10:00:00Z', '2028-01-31T10:00:00Z', '2028-02-29T10:00:00.000Z'],
    ['2026-09-26T10:00:00Z', '2026-10-28T10:00:00Z', '2026-11-26T10:00:00.000Z'],
  ])('preserves billing anniversaries (%s, %s)', (start, payment, end) => {
    expect(paymentPeriodEnd(new Date(start), new Date(payment)).toISOString()).toBe(end);
  });
  it('expires paid access at the boundary even without another webhook', () => {
    expect(hasPaidAccess(new Date('2026-10-26Z'), new Date('2026-10-26Z'))).toBe(false);
    expect(hasPaidAccess(null)).toBe(false);
  });
});
