import { adminSubscriptionStatus, APPROVAL_TIMEOUT_MS } from '../../src/billing/paypal/paypal-admin-status';

describe('Abandoned PayPal approval attempts', () => {
  const now = Date.parse('2026-10-02T12:00:00Z');
  const pending = { status: 'APPROVAL_PENDING', createdAt: new Date(now - APPROVAL_TIMEOUT_MS), paidUntil: null };

  it('keeps approval pending before 24 hours and classifies it at the boundary', () => {
    expect(adminSubscriptionStatus(pending, now - 1)).toBe('APPROVAL_PENDING');
    expect(adminSubscriptionStatus(pending, now)).toBe('ABANDONED');
    expect(adminSubscriptionStatus(pending, now + APPROVAL_TIMEOUT_MS)).toBe('ABANDONED');
    expect(pending.status).toBe('APPROVAL_PENDING');
  });

  it.each(['CREATING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED'])('preserves %s even on old attempts', status => {
    expect(adminSubscriptionStatus({ ...pending, status }, now)).toBe(status);
  });

  it('never classifies an attempt with a recorded payment period as abandoned', () => {
    expect(adminSubscriptionStatus({ ...pending, paidUntil: new Date(now - 1) }, now)).toBe('APPROVAL_PENDING');
  });
});
