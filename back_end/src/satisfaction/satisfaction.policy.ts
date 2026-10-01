import { User } from '../users/user.entity';
export const DAY = 86400000;
export function audience(user: User, now = new Date()) {
  const premium =
    user.role === 'ADMIN' ||
    (['PREMIUM', 'PRO'].includes(user.subscriptionPlan) &&
      ['active', 'trialing'].includes(user.subscriptionStatus) &&
      (!user.subscriptionEndsAt ||
        new Date(user.subscriptionEndsAt).getTime() > now.getTime()));
  return {
    segment: premium ? 'PREMIUM' : 'CLASSIC',
    source:
      user.role !== 'USER'
        ? 'STAFF'
        : !premium
          ? 'FREE'
          : user.billingProvider
            ? 'PAID'
            : 'GIFT',
  };
}
export function eligibility(
  user: User,
  state: {
    visitDays: number;
    lastResponseAt: Date | null;
    dismissedUntil: Date | null;
  },
  now = new Date(),
) {
  const nextResponseAt = state.lastResponseAt
    ? new Date(new Date(state.lastResponseAt).getTime() + 90 * DAY)
    : null;
  const canSubmit = !nextResponseAt || now >= nextResponseAt;
  return {
    ...audience(user, now),
    canSubmit,
    nextResponseAt,
    prompt:
      user.role === 'USER' &&
      canSubmit &&
      state.visitDays >= 3 &&
      now.getTime() - new Date(user.createdAt).getTime() >= 7 * DAY &&
      (!state.dismissedUntil || now >= new Date(state.dismissedUntil)),
  };
}
