import { User } from '../users/user.entity';
export const DAY = 86400000;
export function nextResponseDate(date: Date): Date {
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' });
  const values = (value: Date) => Object.fromEntries(formatter.formatToParts(value).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
  const p = values(date);
  const lastDay = new Date(Date.UTC(p.year, p.month + 1, 0)).getUTCDate();
  const target = Date.UTC(p.year, p.month, Math.min(p.day, lastDay), p.hour, p.minute, p.second, date.getUTCMilliseconds());
  let result = target;
  for (let i = 0; i < 2; i++) {
    const local = values(new Date(result));
    const displayed = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second, date.getUTCMilliseconds());
    result += target - displayed;
  }
  return new Date(result);
}
// Monthly calendar boundaries use the site's time zone, including DST changes.
export function nextSurveyMonth(date: Date): Date {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: 'numeric' }).formatToParts(date);
  const year = Number(parts.find(p => p.type === 'year')!.value);
  const month = Number(parts.find(p => p.type === 'month')!.value);
  const utc = new Date(Date.UTC(year, month, 1));
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(utc));
  return new Date(utc.getTime() - hour * 3600000);
}
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
    ? nextResponseDate(new Date(state.lastResponseAt))
    : null;
  const canSubmit = !nextResponseAt || now >= nextResponseAt;
  return {
    ...audience(user, now),
    canSubmit,
    nextResponseAt,
    prompt:
      user.role === 'USER' &&
      canSubmit &&
      (!state.dismissedUntil || now >= new Date(state.dismissedUntil)),
  };
}
