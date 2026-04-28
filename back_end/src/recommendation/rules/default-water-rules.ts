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

const isoInHours = (hours: number) => {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString();
};

function getRange(targets: TargetMap, key: keyof TargetMap): TargetRange | null {
  return (targets?.[key as string] as TargetRange) ?? null;
}

function hasValue(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function aboveMax(v: number | null | undefined, r: TargetRange | null): boolean {
  if (!hasValue(v)) return false;
  if (!r || r.max === null || r.max === undefined) return false;
  return v > (r.max as number);
}

function belowMin(v: number | null | undefined, r: TargetRange | null): boolean {
  if (!hasValue(v)) return false;
  if (!r || r.min === null || r.min === undefined) return false;
  return v < (r.min as number);
}

function fmtRange(r: TargetRange | null): string {
  if (!r) return '—';
  const min = r.min ?? null;
  const max = r.max ?? null;
  if (min == null && max == null) return '—';
  if (min != null && max != null) return `${min}–${max}`;
  if (min != null) return `≥ ${min}`;
  return `≤ ${max}`;
}

function ruleMinMax(params: {
  keyBase: string;
  metricKey: keyof WaterMeasurement; // ✅ sur les champs réels
  title: string;
  unit?: string;

  hintLow?: string;
  hintHigh?: string;

  severityLow?: RecommendationSeverity;
  severityHigh?: RecommendationSeverity;

  taskTypeLow?: TaskType;
  taskTypeHigh?: TaskType;

  dueLowHours?: number;
  dueHighHours?: number;

  taskTitleLow?: string;
  taskTitleHigh?: string;

  taskDescLow?: string;
  taskDescHigh?: string;
}): WaterRule[] {
  const {
    keyBase,
    metricKey,
    title,
    unit = '',

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
  } = params;

  const targetKey = metricKey as unknown as string;

  return [
    {
      key: `${keyBase}_LOW`,
      when: (m, targets) => belowMin((m as any)[metricKey], getRange(targets, targetKey)),
      build: ({ aquariumId, measurement, targets }) => {
        const r = getRange(targets, targetKey);
        const val = (measurement as any)[metricKey] as number | null | undefined;

        return {
          ruleKey: `${keyBase}_LOW`,
          title: `${title} trop bas`,
          message:
            `${targetKey.toUpperCase()} = ${val ?? '—'}${unit} (objectif ${fmtRange(r)}${unit}).` +
            (hintLow ? ` ${hintLow}` : ''),
          severity: severityLow,
          action: {
            type: 'CREATE_TASK',
            payload: {
              aquariumId,
              type: taskTypeLow,
              title: taskTitleLow,
              dueAt: isoInHours(dueLowHours),
              description: taskDescLow ?? `Re-tester ${targetKey.toUpperCase()} et ajuster progressivement.`,
            },
          },
        };
      },
    },
    {
      key: `${keyBase}_HIGH`,
      when: (m, targets) => aboveMax((m as any)[metricKey], getRange(targets, targetKey)),
      build: ({ aquariumId, measurement, targets }) => {
        const r = getRange(targets, targetKey);
        const val = (measurement as any)[metricKey] as number | null | undefined;

        return {
          ruleKey: `${keyBase}_HIGH`,
          title: `${title} trop haut`,
          message:
            `${targetKey.toUpperCase()} = ${val ?? '—'}${unit} (objectif ${fmtRange(r)}${unit}).` +
            (hintHigh ? ` ${hintHigh}` : ''),
          severity: severityHigh,
          action: {
            type: 'CREATE_TASK',
            payload: {
              aquariumId,
              type: taskTypeHigh,
              title: taskTitleHigh,
              dueAt: isoInHours(dueHighHours),
              description: taskDescHigh ?? `Re-tester ${targetKey.toUpperCase()} et corriger progressivement.`,
            },
          },
        };
      },
    },
  ];
}

export function buildDefaultWaterRules(_: TargetMap): WaterRule[] {
  const rules: WaterRule[] = [];

  // ✅ Urgences
  rules.push({
    key: 'NO2_HIGH',
    when: (m, t) => aboveMax(m.no2, getRange(t, 'no2')),
    build: ({ aquariumId, measurement, targets }) => ({
      ruleKey: 'NO2_HIGH',
      title: 'Nitrites détectés',
      message: `NO2 = ${measurement.no2} mg/L (objectif ${fmtRange(getRange(targets, 'no2'))} mg/L). Action immédiate.`,
      severity: RecommendationSeverity.URGENT,
      action: {
        type: 'CREATE_TASK',
        payload: {
          aquariumId,
          type: TaskType.WATER_CHANGE,
          dueAt: isoInHours(0),
          description: "Changer 40–50% d'eau, oxygéner, réduire nourrissage. Re-tester NO2 dans 24h.",
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
      message: `NH3 = ${measurement.nh3} mg/L (objectif ${fmtRange(getRange(targets, 'nh3'))} mg/L). Risque toxique.`,
      severity: RecommendationSeverity.URGENT,
      action: {
        type: 'CREATE_TASK',
        payload: {
          aquariumId,
          type: TaskType.WATER_CHANGE,
          dueAt: isoInHours(0),
          description: "Changer 30–50% d'eau, stopper nourrissage 24h, vérifier filtration/oxygénation. Re-tester NH3 + NO2.",
        },
      },
    }),
  });

  // ✅ Génériques (toutes les mesures présentes dans WaterMeasurement)
  rules.push(...ruleMinMax({ keyBase: 'PH', metricKey: 'ph', title: 'pH', dueLowHours: 12, dueHighHours: 12 }));
  rules.push(
    ...ruleMinMax({
      keyBase: 'TEMP',
      metricKey: 'temp',
      title: 'Température',
      unit: '°C',
      taskTypeLow: TaskType.OTHER,
      taskTypeHigh: TaskType.OTHER,
      taskTitleLow: 'Vérifier chauffage',
      taskTitleHigh: 'Augmenter oxygénation',
      dueLowHours: 0,
      dueHighHours: 0,
      hintHigh: "Risque d'O2 bas : augmente l’agitation de surface.",
    }),
  );

  rules.push(...ruleMinMax({ keyBase: 'KH', metricKey: 'kh', title: 'KH', severityLow: RecommendationSeverity.INFO, severityHigh: RecommendationSeverity.INFO }));
  rules.push(...ruleMinMax({ keyBase: 'GH', metricKey: 'gh', title: 'GH', severityLow: RecommendationSeverity.INFO, severityHigh: RecommendationSeverity.INFO }));

  rules.push(
    ...ruleMinMax({
      keyBase: 'NO3',
      metricKey: 'no3',
      title: 'Nitrates (NO3)',
      unit: ' mg/L',
      severityLow: RecommendationSeverity.INFO,
      taskTypeHigh: TaskType.WATER_CHANGE,
      dueHighHours: 12,
      taskDescHigh: "Changer 20–30% d'eau. Re-tester NO3 le lendemain.",
    }),
  );

  rules.push(...ruleMinMax({ keyBase: 'FE', metricKey: 'fe', title: 'Fer (Fe)', unit: ' mg/L', severityLow: RecommendationSeverity.INFO }));
  rules.push(...ruleMinMax({ keyBase: 'K', metricKey: 'k', title: 'Potassium (K)', unit: ' mg/L', severityLow: RecommendationSeverity.INFO }));
  rules.push(...ruleMinMax({ keyBase: 'SIO2', metricKey: 'sio2', title: 'Silicates (SiO2)', unit: ' mg/L', severityLow: RecommendationSeverity.INFO }));
  rules.push(...ruleMinMax({ keyBase: 'PO4', metricKey: 'po4', title: 'Phosphates (PO4)', unit: ' mg/L', severityLow: RecommendationSeverity.INFO }));

  // Eau de mer
  rules.push(...ruleMinMax({ keyBase: 'DKH', metricKey: 'dkh', title: 'dKH' }));
  rules.push(...ruleMinMax({ keyBase: 'SALINITY', metricKey: 'salinity', title: 'Salinité' }));
  rules.push(...ruleMinMax({ keyBase: 'CA', metricKey: 'ca', title: 'Calcium (Ca)', unit: ' mg/L' }));
  rules.push(...ruleMinMax({ keyBase: 'MG', metricKey: 'mg', title: 'Magnésium (Mg)', unit: ' mg/L' }));

  return rules;
}
