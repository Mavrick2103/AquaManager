import { BADGES, DAILY_XP, MISSION_CATALOG, selectMonthlyMissions, badgeProgress, legacyMissionKind, levelInfo, monthlyRange, parisDay } from '../../src/gamification/progression-policy';

describe('Progression utile et sans doublons', () => {
  it('ne propose qu’une mission par objectif et réutilise les badges historiques', () => {
    const selection = selectMonthlyMissions(1, '2026-10-01');
    expect(MISSION_CATALOG).toHaveLength(18);
    expect(new Set(MISSION_CATALOG.map(m => m.missionKey)).size).toBe(18);
    expect(new Set(selection.map(m => m.kind)).size).toBe(4);
    expect(new Set(BADGES.map(b => b.key)).size).toBe(BADGES.length);
    expect(BADGES.filter(b => b.key === 'FIRST_MEASUREMENT')).toHaveLength(1);
    expect(BADGES.filter(b => b.key === 'XP_1000')).toHaveLength(1);
    expect(legacyMissionKind('ADD_5_MEASUREMENTS')).toBe('MEASUREMENT');
    expect(legacyMissionKind('OPEN_APP_7_DAYS')).toBe('VISIT');
    expect(legacyMissionKind('CREATE_2_TASKS')).toBe('PLAN');
    expect(legacyMissionKind('ADD_FERTILIZATION_TASK')).toBe('PLAN');
    expect(legacyMissionKind('COMPLETE_WATER_CHANGE')).toBe('CARE');
  });
  it('ne récompense pas la simple connexion en XP ni un score biologique', () => {
    expect(DAILY_XP.VISIT).toBe(0);
    expect(MISSION_CATALOG.filter(m => m.kind !== 'VISIT').every(m => m.target <= 3)).toBe(true);
    expect(BADGES.some(b => String(b.kind).includes('SCORE'))).toBe(false);
  });
  it('change deux catégories et toutes les variantes entre deux mois, y compris au nouvel an', () => {
    for (const user of [1, 2, 42, 1001]) {
      for (let month = 0; month < 24; month++) {
        const day = new Date(Date.UTC(2026, month, 1)).toISOString().slice(0, 10);
        const next = new Date(Date.UTC(2026, month + 1, 1)).toISOString().slice(0, 10);
        const first = selectMonthlyMissions(user, day);
        const second = selectMonthlyMissions(user, next);
        expect(first).toHaveLength(4);
        expect(second.filter(m => first.some(previous => previous.kind === m.kind))).toHaveLength(2);
        expect(second.some(m => first.some(previous => previous.missionKey === m.missionKey))).toBe(false);
        expect(selectMonthlyMissions(user, day.slice(0, 8) + '28')).toEqual(first);
      }
    }
  });
  it('utilise les jours de Paris aux changements de mois et d’heure', () => {
    expect(parisDay(new Date('2026-09-30T22:30:00Z'))).toBe('2026-10-01');
    expect(parisDay(new Date('2026-10-25T01:30:00Z'))).toBe('2026-10-25');
    expect(monthlyRange('2028-02-10').weekEnd).toBe('2028-02-29');
  });
  it('sépare les paliers à vie des objectifs mensuels', () => {
    expect(badgeProgress('MEASUREMENT', { MEASUREMENT: 12 }, { MEASUREMENT: 1 }, 0, 0)).toBe(12);
    expect(badgeProgress('MONTH_VISITS', { VISIT: 30 }, { VISIT: 3 }, 0, 0)).toBe(3);
    expect(badgeProgress('MISSIONS', {}, {}, 4, 0)).toBe(4);
    expect(levelInfo(300).level).toBe(3);
  });
});
