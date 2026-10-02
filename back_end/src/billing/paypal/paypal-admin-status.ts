// Administrative classification only: retain PayPal's status for reconciliation.
export const APPROVAL_TIMEOUT_MS = 24 * 60 * 60 * 1000;

export function adminSubscriptionStatus(subscription: { status: string; createdAt: Date; paidUntil: Date | null }, now = Date.now()): string {
  return subscription.status === 'APPROVAL_PENDING' && !subscription.paidUntil
    && subscription.createdAt.getTime() <= now - APPROVAL_TIMEOUT_MS
    ? 'ABANDONED' : subscription.status;
}

export const ADMIN_STATUS_SQL = "CASE WHEN s.status = 'APPROVAL_PENDING' AND s.paidUntil IS NULL AND s.createdAt <= :approvalCutoff THEN 'ABANDONED' ELSE s.status END";
