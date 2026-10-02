import { audience, eligibility, DAY, nextSurveyMonth, nextResponseDate } from '../../src/satisfaction/satisfaction.policy';
import { SatisfactionService } from '../../src/satisfaction/satisfaction.service';
import { SatisfactionState, SatisfactionResponse } from '../../src/satisfaction/satisfaction.entity';
import { User } from '../../src/users/user.entity';
import { SubmitSatisfactionDto } from '../../src/satisfaction/satisfaction.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
const now = new Date('2026-10-01T12:00:00Z');
const user = (patch = {}) =>
  ({
    id: 7,
    role: 'USER',
    subscriptionPlan: 'CLASSIC',
    subscriptionStatus: 'none',
    createdAt: new Date(now.getTime() - 10 * DAY),
    subscriptionEndsAt: null,
    billingProvider: null,
    ...patch,
  }) as User;
const state = (patch = {}) =>
  ({
    userId: 7,
    visitDays: 3,
    lastVisitDay: null,
    lastResponseAt: null,
    dismissedUntil: null,
    ...patch,
  }) as SatisfactionState;
describe('Satisfaction policy', () => {
  it.each([
    ['2026-09-29T10:00:00Z', '2026-10-29T11:00:00.000Z'],
    ['2026-01-31T11:00:00Z', '2026-02-28T11:00:00.000Z'],
    ['2028-01-31T11:00:00Z', '2028-02-29T11:00:00.000Z'],
    ['2026-12-29T11:00:00Z', '2027-01-29T11:00:00.000Z'],
  ])('waits a full calendar month after %s', (date, expected) => {
    const lastResponseAt = new Date(date);
    const deadline = nextResponseDate(lastResponseAt);
    expect(deadline.toISOString()).toBe(expected);
    expect(eligibility(user(), state({ lastResponseAt }), new Date(deadline.getTime() - 1)).canSubmit).toBe(false);
    expect(eligibility(user(), state({ lastResponseAt }), deadline).canSubmit).toBe(true);
  });
  it('invites on the first visit even for new accounts', () => {
    expect(eligibility(user(), state({ visitDays: 2 }), now).prompt).toBe(
      true,
    );
    expect(eligibility(user({ createdAt: now }), state(), now).prompt).toBe(
      true,
    );
    expect(eligibility(user(), state(), now).prompt).toBe(true);
  });
  it('applies cooldown and dismissal independently of manual access', () => {
    expect(
      eligibility(
        user(),
        state({ lastResponseAt: new Date('2026-10-01T00:00:00Z') }),
        now,
      ).canSubmit,
    ).toBe(false);
    expect(
      eligibility(
        user(),
        state({ lastResponseAt: new Date('2026-09-01T10:00:00Z') }),
        now,
      ).canSubmit,
    ).toBe(true);
    expect(
      eligibility(
        user(),
        state({ dismissedUntil: new Date(now.getTime() + DAY) }),
        now,
      ),
    ).toMatchObject({ prompt: false, canSubmit: true });
  });
  it.each([
    ['2026-09-30T21:59:59Z', '2026-09-30T22:00:00.000Z'],
    ['2026-09-30T22:00:00Z', '2026-10-31T23:00:00.000Z'],
    ['2026-12-31T23:00:00Z', '2027-01-31T23:00:00.000Z'],
    ['2028-02-29T12:00:00Z', '2028-02-29T23:00:00.000Z'],
  ])('uses the next Paris calendar month for %s', (date, expected) => {
    expect(nextSurveyMonth(new Date(date)).toISOString()).toBe(expected);
  });
  it('distinguishes expired access, paid, gifted and staff', () => {
    const premium = {
      subscriptionPlan: 'PREMIUM',
      subscriptionStatus: 'active',
    };
    expect(audience(user(premium), now)).toEqual({
      segment: 'PREMIUM',
      source: 'GIFT',
    });
    expect(
      audience(user({ ...premium, billingProvider: 'paypal' }), now).source,
    ).toBe('PAID');
    expect(
      audience(
        user({ ...premium, subscriptionEndsAt: new Date(now.getTime() - DAY) }),
        now,
      ).segment,
    ).toBe('CLASSIC');
    expect(eligibility(user({ role: 'ADMIN' }), state(), now)).toMatchObject({
      source: 'STAFF',
      prompt: false,
    });
  });
  it.each([
    { rating: 0 },
    { rating: 6 },
    { rating: 3.5 },
    { rating: '5' },
    { rating: 4, premiumRating: 6 },
    { rating: 4, comment: 'x'.repeat(2001) },
  ])('rejects invalid input %#', async (body) => {
    expect(
      (await validate(plainToInstance(SubmitSatisfactionDto, body))).length,
    ).toBeGreaterThan(0);
  });
});
describe('Satisfaction persistence flow', () => {
  let account: User;
  let stored: SatisfactionState;
  let responses: SatisfactionResponse[];
  let manager: any;
  let service: SatisfactionService;
  beforeEach(() => {
    account = user();
    stored = state({ visitDays: 0 });
    responses = [];
    manager = {
      findOne: jest.fn(async () => account),
      findOneBy: jest.fn(async () => stored),
      create: (entity, input) => Object.assign(new entity(), input),
      save: jest.fn(async (entity) => {
        if (entity instanceof SatisfactionResponse) responses.push(entity);
        return entity;
      }),
    };
    service = new SatisfactionService({
      transaction: async (cb) => cb(manager),
    } as any);
  });
  it('counts reloads only once per UTC day and locks the account', async () => {
    expect((await service.visit(7)).prompt).toBe(true);
    expect((await service.visit(7)).prompt).toBe(false);
    expect(stored.visitDays).toBe(1);
    expect(manager.findOne).toHaveBeenCalledWith(
      User,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
  });
  it('stores a plan snapshot and prevents a duplicate response', async () => {
    await service.submit(7, { rating: 4, comment: ' Très utile ' });
    account.subscriptionPlan = 'PREMIUM';
    account.subscriptionStatus = 'active';
    expect(responses[0]).toMatchObject({
      userId: 7,
      rating: 4,
      segment: 'CLASSIC',
      source: 'FREE',
      premiumRating: null,
      comment: 'Très utile',
    });
    await expect(
      service.submit(7, { rating: 5, premiumRating: 5 }),
    ).rejects.toThrow('un mois après');
    expect(responses).toHaveLength(1);
  });
  it('requires the premium score only for premium accounts', async () => {
    await expect(
      service.submit(7, { rating: 5, premiumRating: 3 }),
    ).rejects.toThrow('réservée');
    account.subscriptionPlan = 'PREMIUM';
    account.subscriptionStatus = 'active';
    await expect(service.submit(7, { rating: 5 })).rejects.toThrow('Premium');
    await service.submit(7, { rating: 4, premiumRating: 3 });
    expect(responses[0].premiumRating).toBe(3);
  });
  it('persists the dismissal deadline', async () => {
    const before = Date.now();
    await service.dismiss(7);
    expect(stored.dismissedUntil).toEqual(nextSurveyMonth(new Date(before)));
  });
});
