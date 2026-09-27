import { BadGatewayException } from '@nestjs/common';

export function validDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function isPremiumPrice(money: any): boolean {
  return money?.currency_code === 'EUR' && /^3\.990*$/.test(String(money?.value));
}

export function assertPremiumPlan(plan: any): void {
  const cycles = plan?.billing_cycles;
  const cycle = cycles?.[0];
  const fee = plan?.payment_preferences?.setup_fee;
  if (plan?.status !== 'ACTIVE' || !Array.isArray(cycles) || cycles.length !== 1
      || cycle.tenure_type !== 'REGULAR' || cycle.frequency?.interval_unit !== 'MONTH'
      || Number(cycle.frequency?.interval_count) !== 1 || Number(cycle.total_cycles) !== 0
      || !isPremiumPrice(cycle.pricing_scheme?.fixed_price)
      || (fee && Number(fee.value) !== 0)
      || (plan.taxes && Number(plan.taxes.percentage) !== 0)
      || plan.quantity_supported === true) {
    throw new BadGatewayException('Le plan PayPal doit être actif : 3,99 EUR par mois, sans essai ni frais supplémentaires.');
  }
}

function anniversary(start: Date, months: number): Date {
  const date = new Date(start);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(start.getUTCDate(), lastDay));
  return date;
}

/** Calendar month anchored to the subscription start (including Jan 31 / leap years). */
export function paymentPeriodEnd(start: Date, paidAt: Date): Date {
  const months = Math.max(0, (paidAt.getUTCFullYear() - start.getUTCFullYear()) * 12
    + paidAt.getUTCMonth() - start.getUTCMonth());
  // Small early settlement times belong to the cycle beginning at that anniversary.
  const nearBoundary = new Date(paidAt.getTime() + 5 * 60_000);
  const cycle = anniversary(start, months) <= nearBoundary ? months : Math.max(0, months - 1);
  return anniversary(start, cycle + 1);
}

export function hasPaidAccess(endsAt: Date | null, now = new Date()): boolean {
  return !!endsAt && endsAt.getTime() > now.getTime();
}

export const TERMINAL_STATUSES = new Set(['CANCELLED', 'EXPIRED']);
export const PAYPAL_EVENTS = new Set([
  'BILLING.SUBSCRIPTION.CREATED', 'BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.UPDATED', 'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.SUSPENDED', 'BILLING.SUBSCRIPTION.EXPIRED',
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED', 'PAYMENT.SALE.COMPLETED',
  'PAYMENT.SALE.REFUNDED', 'PAYMENT.SALE.REVERSED',
]);
