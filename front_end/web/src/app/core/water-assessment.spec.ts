import { assessWaterValues } from './water-assessment';
describe('Water assessment', () => {
  const now = Date.parse('2026-10-29T12:00:00Z');
  const targets = { ph: { min: 6, max: 8 }, temp: { min: 20, max: 27 }, no2: {} };
  it('counts only values with a usable reference, including zero', () => {
    expect(assessWaterValues({ measuredAt: new Date(now).toISOString(), ph: 7, no2: 0 }, targets, ['ph', 'temp', 'no2'], now))
      .toEqual({ evaluated: 1, outside: 0, recent: true });
    expect(assessWaterValues({ no2: 0 }, { no2: { max: 0.1 } }, ['no2'], now).evaluated).toBe(1);
  });
  it('does not turn missing data into a positive assessment', () => {
    expect(assessWaterValues(null, targets, ['ph'], now).evaluated).toBe(0);
    expect(assessWaterValues({ ph: 7 }, null, ['ph'], now).evaluated).toBe(0);
    expect(assessWaterValues({ ph: null }, targets, ['ph'], now).evaluated).toBe(0);
  });
  it('distinguishes out-of-range, stale, invalid and future readings', () => {
    expect(assessWaterValues({ ph: 9 }, targets, ['ph'], now).outside).toBe(1);
    for (const measuredAt of ['invalid', new Date(now - 15 * 86400000).toISOString(), new Date(now + 86400000).toISOString()]) {
      expect(assessWaterValues({ measuredAt, ph: 7 }, targets, ['ph'], now).recent).toBeFalse();
    }
  });
});
