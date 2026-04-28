import { TargetMap } from './aquarium-targets.entity';

// ✅ Toutes les métriques possibles (celles qui existent dans WaterMeasurement)
export const ALL_TARGET_KEYS = [
  // commun
  'ph',
  'temp',

  // eau douce
  'kh',
  'gh',
  'no2',
  'no3',
  'fe',
  'k',
  'sio2',
  'nh3',

  // eau de mer
  'dkh',
  'salinity',
  'ca',
  'mg',
  'po4',
] as const;

export type TargetProfileKey =
  | 'FRESH_COMMUNITY'
  | 'FRESH_PLANTED'
  | 'FRESH_SHRIMP'
  | 'FRESH_CICHLID'
  | 'SALT_REEF'
  | 'SALT_FISH_ONLY'
  | 'CUSTOM';

function withAllKeys(partial: TargetMap): TargetMap {
  // ✅ garantit que tous les champs existent (min/max à null si non défini)
  const base: TargetMap = {};
  for (const k of ALL_TARGET_KEYS) base[k] = { min: null, max: null };
  return { ...base, ...partial };
}

// ⚠️ Valeurs “débutant” volontairement larges.
// Les profils sont cohérents “par type de bac” et renvoient TOUTES les clés.
export const DEFAULT_TARGET_PROFILES: Record<TargetProfileKey, TargetMap> = {
  // Eau douce “classique”
  FRESH_COMMUNITY: withAllKeys({
    no2: { min: 0, max: 0 },
    no3: { min: 5, max: 20 },
    ph: { min: 6.5, max: 7.5 },
    kh: { min: 3, max: 8 },
    gh: { min: 4, max: 12 },
    temp: { min: 24, max: 26 },
  }),

  // Bac planté (CO2 non mesuré chez toi → on ne le met pas)
  FRESH_PLANTED: withAllKeys({
    no2: { min: 0, max: 0 },
    no3: { min: 5, max: 20 },
    po4: { min: 0.05, max: 0.5 }, // utile contre algues / équilibre (si tu testes)
    ph: { min: 6.2, max: 7.2 },
    kh: { min: 2, max: 6 },
    gh: { min: 4, max: 10 },
    temp: { min: 23, max: 26 },
    fe: { min: 0.02, max: 0.1 }, // si tu mesures
    k: { min: 5, max: 20 },      // si tu mesures
  }),

  // Crevettes (Neocaridina “débutant”)
  FRESH_SHRIMP: withAllKeys({
    no2: { min: 0, max: 0 },
    no3: { min: 0, max: 20 },
    ph: { min: 6.8, max: 7.6 },
    kh: { min: 2, max: 6 },
    gh: { min: 6, max: 10 },
    temp: { min: 21, max: 24 },
    nh3: { min: 0, max: 0 },
  }),

  // Cichlidés (type Malawi/Tanga “débutant”)
  FRESH_CICHLID: withAllKeys({
    no2: { min: 0, max: 0 },
    no3: { min: 0, max: 30 },
    ph: { min: 7.8, max: 8.6 },
    kh: { min: 6, max: 12 },
    gh: { min: 10, max: 20 },
    temp: { min: 24, max: 27 },
    nh3: { min: 0, max: 0 },
  }),

  // Eau de mer “reef”
  SALT_REEF: withAllKeys({
    dkh: { min: 7, max: 11 },
    salinity: { min: 33, max: 36 },
    ca: { min: 380, max: 450 },
    mg: { min: 1200, max: 1400 },
    no2: { min: 0, max: 0 },
    no3: { min: 0, max: 10 },
    po4: { min: 0.02, max: 0.08 },
    temp: { min: 24, max: 26 },
  }),

  // Eau de mer “fish only”
  SALT_FISH_ONLY: withAllKeys({
    salinity: { min: 33, max: 36 },
    no2: { min: 0, max: 0 },
    no3: { min: 0, max: 25 },
    po4: { min: 0.02, max: 0.2 },
    temp: { min: 24, max: 26 },
  }),

  CUSTOM: withAllKeys({}),
};

export function resolveDefaultProfileKey(waterType: 'EAU_DOUCE' | 'EAU_DE_MER'): TargetProfileKey {
  return waterType === 'EAU_DE_MER' ? 'SALT_REEF' : 'FRESH_COMMUNITY';
}

export function getTargetsForProfile(profileKey: string): TargetMap {
  const key = (profileKey as TargetProfileKey) ?? 'FRESH_COMMUNITY';
  return DEFAULT_TARGET_PROFILES[key] ?? DEFAULT_TARGET_PROFILES.FRESH_COMMUNITY;
}
