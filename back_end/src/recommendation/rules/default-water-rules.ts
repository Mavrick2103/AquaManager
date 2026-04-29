import { WaterMeasurement } from '../../water-measurement/water-measurement.entity';
import { TargetMap, TargetRange } from '../../aquarium-targets/aquarium-targets.entity';
import { RecommendationSeverity } from '../recommendation.entity';
import { TaskType } from '../../tasks/task.entity';

export type ProposedAction = {
  type: 'CREATE_TASK';
  payload: {
    aquariumId: number;
    title?: string;
    description?: string;
    dueAt: string; // ISO
    type: TaskType;
  };
};

export type WaterRuleResult = {
  ruleKey: string;
  title: string;
  message: string;
  severity: RecommendationSeverity;
  action: ProposedAction;
};

export type WaterRule = {
  key: string;
  when: (m: WaterMeasurement, targets: TargetMap) => boolean;
  build: (ctx: {
    measurement: WaterMeasurement;
    aquariumId: number;
    targets: TargetMap;
  }) => WaterRuleResult;
};

// =========================
// Utils
// =========================

const isoInHours = (hours: number) => {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString();
};

// ✅ accepte number OU string (ex: DECIMAL MySQL)
function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;

  if (typeof v === 'number') {
    return Number.isFinite(v) ? v : null;
  }

  if (typeof v === 'string') {
    const s = v.trim().replace(',', '.');
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

function fmtValue(v: unknown): string {
  const n = toNumber(v);
  return n === null ? '—' : String(n);
}

function getRange(targets: TargetMap, key: keyof TargetMap): TargetRange | null {
  return (targets?.[key as string] as TargetRange) ?? null;
}

function rangeMin(r: TargetRange | null): number | null {
  return toNumber(r?.min);
}
function rangeMax(r: TargetRange | null): number | null {
  return toNumber(r?.max);
}

function aboveMax(v: unknown, r: TargetRange | null): boolean {
  const val = toNumber(v);
  const max = rangeMax(r);
  if (val === null || max === null) return false;
  return val > max;
}

function belowMin(v: unknown, r: TargetRange | null): boolean {
  const val = toNumber(v);
  const min = rangeMin(r);
  if (val === null || min === null) return false;
  return val < min;
}

function fmtRange(r: TargetRange | null): string {
  if (!r) return '—';
  const min = rangeMin(r);
  const max = rangeMax(r);

  if (min == null && max == null) return '—';
  if (min != null && max != null) return `${min}–${max}`;
  if (min != null) return `≥ ${min}`;
  return `≤ ${max}`;
}

function clampText(lines: string[]): string {
  return lines.filter(Boolean).join('\n');
}

// =========================
// CO2 (calcul via pH + KH)
// Formule approx: CO2(mg/L) = 3 * KH * 10^(7 - pH)
// =========================
function calcCo2MgL(m: WaterMeasurement): number | null {
  const ph = toNumber(m.ph);
  const kh = toNumber(m.kh);
  if (ph === null || kh === null) return null;
  // KH en °dKH
  const co2 = 3 * kh * Math.pow(10, 7 - ph);
  if (!Number.isFinite(co2)) return null;
  // arrondi lisible
  return Math.round(co2 * 10) / 10;
}

// =========================
// Rule factory (Min/Max)
// - supporte un getter (pour champs réels ou calculés)
// =========================

type RuleMinMaxParams = {
  keyBase: string;               // ex: 'PH'
  targetKey: keyof TargetMap;    // ex: 'ph' (clé targets)
  title: string;                 // affichage
  unit?: string;

  value: (m: WaterMeasurement) => unknown; // champ réel ou calculé

  hintLow?: (m: WaterMeasurement, t: TargetMap) => string;
  hintHigh?: (m: WaterMeasurement, t: TargetMap) => string;

  severityLow?: RecommendationSeverity;
  severityHigh?: RecommendationSeverity;

  taskTypeLow?: TaskType;
  taskTypeHigh?: TaskType;

  dueLowHours?: number;
  dueHighHours?: number;

  taskTitleLow?: string;
  taskTitleHigh?: string;

  taskDescLow?: (m: WaterMeasurement, t: TargetMap) => string;
  taskDescHigh?: (m: WaterMeasurement, t: TargetMap) => string;
};

function ruleMinMax(p: RuleMinMaxParams): WaterRule[] {
  const {
    keyBase,
    targetKey,
    title,
    unit = '',
    value,

    hintLow,
    hintHigh,

    severityLow = RecommendationSeverity.WARN,
    severityHigh = RecommendationSeverity.WARN,

    taskTypeLow = TaskType.WATER_TEST,
    taskTypeHigh = TaskType.WATER_TEST,

    dueLowHours = 24,
    dueHighHours = 24,

    taskTitleLow,
    taskTitleHigh,

    taskDescLow,
    taskDescHigh,
  } = p;

  return [
    {
      key: `${keyBase}_LOW`,
      when: (m, targets) => belowMin(value(m), getRange(targets, targetKey)),
      build: ({ aquariumId, measurement, targets }) => {
        const r = getRange(targets, targetKey);
        const val = value(measurement);

        return {
          ruleKey: `${keyBase}_LOW`,
          title: `${title} trop bas`,
          message:
            `${String(targetKey).toUpperCase()} = ${fmtValue(val)}${unit} (objectif ${fmtRange(r)}${unit}).` +
            (hintLow ? ` ${hintLow(measurement, targets)}` : ''),
          severity: severityLow,
          action: {
            type: 'CREATE_TASK',
            payload: {
              aquariumId,
              type: taskTypeLow,
              title: taskTitleLow,
              dueAt: isoInHours(dueLowHours),
              description:
                (taskDescLow ? taskDescLow(measurement, targets) : undefined) ??
                `Re-tester ${String(targetKey).toUpperCase()} et ajuster progressivement.`,
            },
          },
        };
      },
    },
    {
      key: `${keyBase}_HIGH`,
      when: (m, targets) => aboveMax(value(m), getRange(targets, targetKey)),
      build: ({ aquariumId, measurement, targets }) => {
        const r = getRange(targets, targetKey);
        const val = value(measurement);

        return {
          ruleKey: `${keyBase}_HIGH`,
          title: `${title} trop haut`,
          message:
            `${String(targetKey).toUpperCase()} = ${fmtValue(val)}${unit} (objectif ${fmtRange(r)}${unit}).` +
            (hintHigh ? ` ${hintHigh(measurement, targets)}` : ''),
          severity: severityHigh,
          action: {
            type: 'CREATE_TASK',
            payload: {
              aquariumId,
              type: taskTypeHigh,
              title: taskTitleHigh,
              dueAt: isoInHours(dueHighHours),
              description:
                (taskDescHigh ? taskDescHigh(measurement, targets) : undefined) ??
                `Re-tester ${String(targetKey).toUpperCase()} et corriger progressivement.`,
            },
          },
        };
      },
    },
  ];
}

// =========================
// Default rules
// =========================

export function buildDefaultWaterRules(_: TargetMap): WaterRule[] {
  const rules: WaterRule[] = [];

  // ===== URGENCES =====
  rules.push({
    key: 'NO2_HIGH',
    when: (m, t) => aboveMax(m.no2, getRange(t, 'no2')),
    build: ({ aquariumId, measurement, targets }) => ({
      ruleKey: 'NO2_HIGH',
      title: 'Nitrites détectés',
      message: `NO2 = ${fmtValue(measurement.no2)} mg/L (objectif ${fmtRange(getRange(targets, 'no2'))} mg/L). Action immédiate.`,
      severity: RecommendationSeverity.URGENT,
      action: {
        type: 'CREATE_TASK',
        payload: {
          aquariumId,
          type: TaskType.WATER_CHANGE,
          dueAt: isoInHours(0),
          title: "Changement d'eau (urgence NO2)",
          description: clampText([
            "🚨 NO2 trop haut = toxique.",
            "• Changer 40–50% d’eau immédiatement",
            "• Augmenter l’oxygénation (bulleur / rejet en surface)",
            "• Réduire / stopper nourrissage 24h",
            "• Re-tester NO2 dans 12–24h",
          ]),
        },
      },
    }),
  });

  rules.push({
    key: 'NH3_HIGH',
    when: (m, t) => aboveMax(m.nh3, getRange(t, 'nh3')),
    build: ({ aquariumId, measurement, targets }) => ({
      ruleKey: 'NH3_HIGH',
      title: 'Ammoniac trop élevé',
      message: `NH3 = ${fmtValue(measurement.nh3)} mg/L (objectif ${fmtRange(getRange(targets, 'nh3'))} mg/L). Risque toxique.`,
      severity: RecommendationSeverity.URGENT,
      action: {
        type: 'CREATE_TASK',
        payload: {
          aquariumId,
          type: TaskType.WATER_CHANGE,
          dueAt: isoInHours(0),
          title: 'Urgence NH3',
          description: clampText([
            "🚨 NH3/NH4 élevé = très toxique (surtout si pH haut).",
            "• Changer 30–50% d’eau",
            "• Stop nourrissage 24h",
            "• Vérifier filtration + oxygénation",
            "• Re-tester NH3 + NO2 + pH",
          ]),
        },
      },
    }),
  });

  // ===== pH (conseils concrets) =====
  rules.push(
    ...ruleMinMax({
      keyBase: 'PH',
      targetKey: 'ph',
      title: 'pH',
      value: (m) => m.ph,
      dueLowHours: 12,
      dueHighHours: 12,
      taskTitleLow: 'pH trop bas : stabiliser',
      taskTitleHigh: 'pH trop haut : réduire',
      taskDescLow: (m) => clampText([
        "Objectif : remonter doucement (pas de gros swings).",
        "• Vérifie KH (si KH trop bas → pH instable)",
        "• Augmente le KH progressivement (reminéralisant / eau plus dure)",
        "• Aère davantage (si CO2 trop haut → pH peut baisser)",
        "• Re-teste pH + KH demain",
        "",
        `Mesure actuelle: pH ${fmtValue(m.ph)} / KH ${fmtValue(m.kh)}`,
      ]),
      taskDescHigh: (m) => clampText([
        "Objectif : baisser progressivement (éviter les chocs).",
        "• Vérifie KH (KH haut maintient pH haut)",
        "• Réduis l’agitation de surface si tu injectes du CO2 (sinon CO2 s’échappe)",
        "• Option douce : mélange avec eau osmosée (baisse KH → pH plus facile à ajuster)",
        "• Évite les produits 'pH-' en mode bourrin",
        "• Re-teste pH + KH demain",
        "",
        `Mesure actuelle: pH ${fmtValue(m.ph)} / KH ${fmtValue(m.kh)}`,
      ]),
    }),
  );

  // ===== Temp =====
  rules.push(
    ...ruleMinMax({
      keyBase: 'TEMP',
      targetKey: 'temp',
      title: 'Température',
      unit: '°C',
      value: (m) => m.temp,
      taskTypeLow: TaskType.OTHER,
      taskTypeHigh: TaskType.OTHER,
      taskTitleLow: 'Temp trop basse : vérifier chauffage',
      taskTitleHigh: 'Temp trop haute : refroidir',
      dueLowHours: 0,
      dueHighHours: 0,
      hintHigh: () => "Risque d’O2 bas : augmente l’agitation de surface.",
      taskDescLow: (m) => clampText([
        "• Vérifie chauffage + thermostat",
        "• Contrôle température pièce / couvercle",
        "• Remonte max ~1°C / heure",
        `Temp actuelle: ${fmtValue(m.temp)}°C`,
      ]),
      taskDescHigh: (m) => clampText([
        "• Augmente oxygénation (rejet surface / bulleur)",
        "• Ventile (ventilos) / retire couvercle si possible",
        "• Baisse max ~1°C / heure",
        `Temp actuelle: ${fmtValue(m.temp)}°C`,
      ]),
    }),
  );

  // ===== KH / GH =====
  rules.push(
    ...ruleMinMax({
      keyBase: 'KH',
      targetKey: 'kh',
      title: 'KH',
      value: (m) => m.kh,
      severityLow: RecommendationSeverity.INFO,
      severityHigh: RecommendationSeverity.INFO,
      taskTitleLow: 'KH bas : stabiliser le pH',
      taskTitleHigh: 'KH haut : eau trop tamponnée',
      taskDescLow: (m) => clampText([
        "KH bas = pH instable.",
        "• Reminéraliser doucement (sels GH/KH) ou eau plus dure",
        "• Évite de toucher au pH tant que KH est trop bas",
        `KH actuel: ${fmtValue(m.kh)}`,
      ]),
      taskDescHigh: (m) => clampText([
        "KH haut = pH difficile à faire baisser.",
        "• Mélange avec eau osmosée progressivement",
        "• Re-teste KH après chaque changement d’eau",
        `KH actuel: ${fmtValue(m.kh)}`,
      ]),
    }),
  );

  rules.push(
    ...ruleMinMax({
      keyBase: 'GH',
      targetKey: 'gh',
      title: 'GH',
      value: (m) => m.gh,
      severityLow: RecommendationSeverity.INFO,
      severityHigh: RecommendationSeverity.INFO,
      taskTitleLow: 'GH bas : reminéraliser',
      taskTitleHigh: 'GH haut : eau trop dure',
      taskDescLow: (m) => clampText([
        "GH trop bas → carences possibles (crevettes / plantes).",
        "• Reminéraliser (sels GH+) progressivement",
        `GH actuel: ${fmtValue(m.gh)}`,
      ]),
      taskDescHigh: (m) => clampText([
        "GH trop haut → certaines espèces sensibles.",
        "• Couper avec eau osmosée progressivement",
        `GH actuel: ${fmtValue(m.gh)}`,
      ]),
    }),
  );

  // ===== NO3 =====
  rules.push(
    ...ruleMinMax({
      keyBase: 'NO3',
      targetKey: 'no3',
      title: 'Nitrates (NO3)',
      unit: ' mg/L',
      value: (m) => m.no3,
      severityLow: RecommendationSeverity.INFO,
      taskTypeHigh: TaskType.WATER_CHANGE,
      dueHighHours: 12,
      taskTitleHigh: "NO3 haut : réduire",
      taskDescHigh: (m) => clampText([
        "• Changer 20–30% d’eau",
        "• Vérifier sur-nourrissage / surpopulation",
        "• Ajouter plantes rapides (si bac planté)",
        "• Re-tester NO3 demain",
        `NO3 actuel: ${fmtValue(m.no3)} mg/L`,
      ]),
      taskTitleLow: 'NO3 bas : ok (selon bac)',
      taskDescLow: (m) => clampText([
        "NO3 très bas peut limiter les plantes (bac très planté).",
        "• Si bac planté : surveiller croissance / carences",
        "• Ne rien faire si bac non planté",
        `NO3 actuel: ${fmtValue(m.no3)} mg/L`,
      ]),
    }),
  );

  // ===== PO4 =====
  rules.push(
    ...ruleMinMax({
      keyBase: 'PO4',
      targetKey: 'po4',
      title: 'Phosphates (PO4)',
      unit: ' mg/L',
      value: (m) => m.po4,
      severityLow: RecommendationSeverity.INFO,
      severityHigh: RecommendationSeverity.WARN,
      taskTitleHigh: 'PO4 haut : risque algues',
      taskDescHigh: (m) => clampText([
        "• Changer 20–30% d’eau",
        "• Réduire nourriture / enlever restes",
        "• Nettoyer filtre léger (sans tout tuer)",
        "• Re-tester PO4 dans 24–48h",
        `PO4 actuel: ${fmtValue(m.po4)} mg/L`,
      ]),
      taskTitleLow: 'PO4 bas : plantes peuvent manquer',
      taskDescLow: (m) => clampText([
        "PO4 trop bas peut freiner les plantes (si bac planté).",
        "• Si plantes en galère : ajuster fertilisation doucement",
        `PO4 actuel: ${fmtValue(m.po4)} mg/L`,
      ]),
    }),
  );

  // ===== FE / K / SiO2 =====
  rules.push(
    ...ruleMinMax({
      keyBase: 'FE',
      targetKey: 'fe',
      title: 'Fer (Fe)',
      unit: ' mg/L',
      value: (m) => m.fe,
      severityLow: RecommendationSeverity.INFO,
      severityHigh: RecommendationSeverity.INFO,
      taskTitleLow: 'Fe bas : surveiller plantes',
      taskTitleHigh: 'Fe haut : attention surdosage',
      taskDescHigh: (m) => clampText([
        "Fe trop haut = risque algues / stress vivant.",
        "• Stop fertilisation fer 3–5 jours",
        "• Petit changement d’eau si nécessaire",
        `Fe actuel: ${fmtValue(m.fe)} mg/L`,
      ]),
    }),
  );

  rules.push(
    ...ruleMinMax({
      keyBase: 'K',
      targetKey: 'k',
      title: 'Potassium (K)',
      unit: ' mg/L',
      value: (m) => m.k,
      severityLow: RecommendationSeverity.INFO,
      severityHigh: RecommendationSeverity.INFO,
      taskTitleLow: 'K bas : plantes',
      taskTitleHigh: 'K haut : surdosage',
      taskDescHigh: (m) => clampText([
        "• Réduire fertilisation K",
        "• Re-tester dans quelques jours",
        `K actuel: ${fmtValue(m.k)} mg/L`,
      ]),
    }),
  );

  rules.push(
    ...ruleMinMax({
      keyBase: 'SIO2',
      targetKey: 'sio2',
      title: 'Silicates (SiO2)',
      unit: ' mg/L',
      value: (m) => m.sio2,
      severityHigh: RecommendationSeverity.INFO,
      taskTitleHigh: 'SiO2 haut : diatomées possibles',
      taskDescHigh: (m) => clampText([
        "SiO2 haut → algues brunes/diatomées possibles.",
        "• Résine anti-silicates (si besoin) / changements d’eau",
        "• Patience si bac jeune",
        `SiO2 actuel: ${fmtValue(m.sio2)} mg/L`,
      ]),
    }),
  );

  // ===== CO2 calculé (via pH+KH) =====
  // 👉 utilise les targets "co2" uniquement si tu l’as dans TargetMap.
  // Si tu n’as pas co2 dans TargetMap, supprime ce bloc.
  rules.push(
    ...ruleMinMax({
      keyBase: 'CO2_CALC',
      targetKey: 'co2' as any, // <= garde si TargetMap a bien 'co2'
      title: 'CO₂ (estimé pH/KH)',
      unit: ' mg/L',
      value: (m) => calcCo2MgL(m),
      severityLow: RecommendationSeverity.INFO,
      severityHigh: RecommendationSeverity.WARN,
      taskTitleLow: 'CO₂ bas : plantes (si bac planté)',
      taskTitleHigh: 'CO₂ haut : risque pour poissons',
      hintHigh: () => "Si tu injectes du CO₂ : attention aux surdosages.",
      taskDescLow: (m) => clampText([
        "CO₂ estimé bas (si bac planté).",
        "• Vérifie drop-checker (si tu en as)",
        "• Augmente très progressivement l’injection (si système CO2)",
        `CO2 estimé: ${fmtValue(calcCo2MgL(m))} mg/L (pH ${fmtValue(m.ph)}, KH ${fmtValue(m.kh)})`,
      ]),
      taskDescHigh: (m) => clampText([
        "CO₂ estimé haut = danger (asphyxie).",
        "• Coupe / baisse CO2 immédiatement",
        "• Augmente agitation surface / oxygénation",
        "• Surveille poissons (surface = manque O2)",
        `CO2 estimé: ${fmtValue(calcCo2MgL(m))} mg/L (pH ${fmtValue(m.ph)}, KH ${fmtValue(m.kh)})`,
      ]),
    }),
  );

  // ===== Salé =====
  rules.push(
    ...ruleMinMax({
      keyBase: 'DKH',
      targetKey: 'dkh',
      title: 'dKH',
      value: (m) => m.dkh,
    }),
  );

  rules.push(
    ...ruleMinMax({
      keyBase: 'SALINITY',
      targetKey: 'salinity',
      title: 'Salinité',
      value: (m) => m.salinity,
      taskTitleLow: 'Salinité basse : corriger',
      taskTitleHigh: 'Salinité haute : corriger',
      taskDescLow: (m) => clampText([
        "• Ajuster avec eau salée (petites étapes)",
        "• Mesurer avec réfractomètre si possible",
        `Salinité actuelle: ${fmtValue(m.salinity)}`,
      ]),
      taskDescHigh: (m) => clampText([
        "• Ajuster avec eau osmosée (petites étapes)",
        "• Mesurer avec réfractomètre si possible",
        `Salinité actuelle: ${fmtValue(m.salinity)}`,
      ]),
    }),
  );

  rules.push(
    ...ruleMinMax({
      keyBase: 'CA',
      targetKey: 'ca',
      title: 'Calcium (Ca)',
      unit: ' mg/L',
      value: (m) => m.ca,
    }),
  );

  rules.push(
    ...ruleMinMax({
      keyBase: 'MG',
      targetKey: 'mg',
      title: 'Magnésium (Mg)',
      unit: ' mg/L',
      value: (m) => m.mg,
    }),
  );

  return rules;
}