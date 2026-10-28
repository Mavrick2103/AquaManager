export type ActivityKind = 'VISIT' | 'MEASUREMENT' | 'JOURNAL' | 'PLAN' | 'CARE' | 'SOLUTIONS';
export type ActivityCounts = Partial<Record<ActivityKind, number>>;

// A reward counts days of useful activity, never the number of animals or doses.
export const DAILY_XP: Record<ActivityKind, number> = {
  VISIT: 0, MEASUREMENT: 10, JOURNAL: 5, PLAN: 5, CARE: 15, SOLUTIONS: 5,
};

export function legacyMissionKind(key: string): ActivityKind | null {
  if (/^ADD_\d+_MEASUREMENTS$/.test(key)) return 'MEASUREMENT';
  if (/^OPEN_APP_\d+_DAYS$/.test(key)) return 'VISIT';
  if (/^CREATE_\d+_TASKS$/.test(key) || /^ADD_.*_TASK$/.test(key)) return 'PLAN';
  if (key.startsWith('COMPLETE_')) return 'CARE';
  if (key === 'USE_SOLUTIONS_TAB') return 'SOLUTIONS';
  return null;
}
export type MissionSeed = { missionKey: string; kind: ActivityKind; title: string; description: string; target: number; xpReward: number };

// Keys of the first catalogue remain valid so an in-progress month is stable.
export const MISSION_CATALOG: readonly MissionSeed[] = [
  { missionKey: 'V2_VISIT', kind: 'VISIT', title: 'Garder le contact', description: 'Consulte ton tableau de bord 3 jours différents ce mois-ci, à ton rythme.', target: 3, xpReward: 40 },
  { missionKey: 'V2_MEASURE', kind: 'MEASUREMENT', title: 'Des repères dans le temps', description: 'Enregistre des mesures 2 jours différents, lorsque le suivi de ton bac le nécessite.', target: 2, xpReward: 60 },
  { missionKey: 'V2_JOURNAL', kind: 'JOURNAL', title: 'Garder une trace', description: 'Ajoute une observation dans le commentaire de tes mesures sur 2 jours différents.', target: 2, xpReward: 40 },
  { missionKey: 'V2_PLAN', kind: 'PLAN', title: 'Anticiper les prochains soins', description: 'Planifie une tâche réellement utile à ton aquarium dans le calendrier.', target: 1, xpReward: 30 },
  { missionKey: 'V2_CARE', kind: 'CARE', title: 'Une routine qui dure', description: 'Marque des tâches réellement effectuées comme terminées sur 2 jours différents.', target: 2, xpReward: 70 },
  { missionKey: 'V2_SOLUTIONS', kind: 'SOLUTIONS', title: 'Comprendre avant d’agir', description: 'Consulte les conseils de l’assistant Classic dans Solutions. Aucune intervention imposée.', target: 1, xpReward: 30 },
  { missionKey: 'V2_VISIT_5', kind: 'VISIT', title: 'Les rendez-vous du bac', description: 'Consulte ton tableau de bord sur 5 jours différents, sans obligation de jours consécutifs.', target: 5, xpReward: 60 },
  { missionKey: 'V2_VISIT_7', kind: 'VISIT', title: 'Un fil rouge dans le mois', description: 'Retrouve le suivi de tes aquariums sur 7 jours différents dans le mois.', target: 7, xpReward: 80 },
  { missionKey: 'V2_MEASURE_1', kind: 'MEASUREMENT', title: 'Un point de repère', description: 'Enregistre un relevé des paramètres quand ton aquarium en a besoin.', target: 1, xpReward: 30 },
  { missionKey: 'V2_MEASURE_3', kind: 'MEASUREMENT', title: 'Suivre l’évolution de l’eau', description: 'Conserve des relevés sur 3 jours différents, selon le rythme de contrôle adapté à ton bac.', target: 3, xpReward: 80 },
  { missionKey: 'V2_JOURNAL_1', kind: 'JOURNAL', title: 'Au-delà des chiffres', description: 'Accompagne une nouvelle mesure d’un commentaire sur ce que tu observes dans le bac.', target: 1, xpReward: 25 },
  { missionKey: 'V2_JOURNAL_3', kind: 'JOURNAL', title: 'Le carnet de bord', description: 'Ajoute tes observations aux mesures sur 3 jours différents. Pas de mesure supplémentaire pour les points.', target: 3, xpReward: 60 },
  { missionKey: 'V2_PLAN_2', kind: 'PLAN', title: 'Un planning vivant', description: 'Complète ton calendrier de soins utiles sur 2 jours différents, uniquement lorsqu’un besoin se présente.', target: 2, xpReward: 45 },
  { missionKey: 'V2_PLAN_3', kind: 'PLAN', title: 'Organiser dans la durée', description: 'Planifie les prochains besoins de ton bac sur 3 jours différents. Aucune tâche superflue nécessaire.', target: 3, xpReward: 60 },
  { missionKey: 'V2_CARE_1', kind: 'CARE', title: 'Du planning à l’action', description: 'Termine une tâche prévue, après l’avoir réellement effectuée pour ton aquarium.', target: 1, xpReward: 35 },
  { missionKey: 'V2_CARE_3', kind: 'CARE', title: 'Des soins au bon rythme', description: 'Termine des tâches utiles sur 3 jours différents. Suis les besoins du bac, sans accélérer son entretien.', target: 3, xpReward: 90 },
  { missionKey: 'V2_SOLUTIONS_2', kind: 'SOLUTIONS', title: 'Prendre du recul', description: 'Consulte les conseils Classic sur 2 jours différents pour refaire le point sur ton suivi.', target: 2, xpReward: 45 },
  { missionKey: 'V2_SOLUTIONS_3', kind: 'SOLUTIONS', title: 'Un suivi éclairé', description: 'Reviens consulter les conseils Classic sur 3 jours différents. Tu n’as pas à appliquer une action pour réussir.', target: 3, xpReward: 60 },
];

export const MISSIONS_PER_MONTH = 4;
const ROTATING_KINDS: ActivityKind[] = ['VISIT', 'MEASUREMENT', 'PLAN', 'JOURNAL', 'CARE', 'SOLUTIONS'];

export function selectMonthlyMissions(userId: number, day: string): MissionSeed[] {
  const [year, month] = day.split('-').map(Number);
  const period = year * 12 + month - 1;
  const start = (period * 2 + userId) % ROTATING_KINDS.length;
  return Array.from({ length: MISSIONS_PER_MONTH }, (_, index) => {
    const kind = ROTATING_KINDS[(start + index) % ROTATING_KINDS.length];
    const variants = MISSION_CATALOG.filter(mission => mission.kind === kind);
    const variant = (period + Math.floor(period / 3) + userId + ROTATING_KINDS.indexOf(kind)) % variants.length;
    return variants[variant];
  });
}

export const BADGES = [
  { key: 'FIRST_MEASUREMENT', title: 'Première mesure', description: 'Enregistrer une première mesure.', kind: 'MEASUREMENT', target: 1 },
  { key: 'MEASUREMENT_5_DAYS', title: 'Des repères solides', description: 'Enregistrer des mesures sur 5 jours différents, sans limite de temps.', kind: 'MEASUREMENT', target: 5 },
  { key: 'MEASUREMENT_12_DAYS', title: 'Mémoire du bac', description: 'Enregistrer des mesures sur 12 jours différents, sans limite de temps.', kind: 'MEASUREMENT', target: 12 },
  { key: 'FIRST_CARE', title: 'Un soin accompli', description: 'Terminer une tâche utile à son aquarium.', kind: 'CARE', target: 1 },
  { key: 'CARE_5_DAYS', title: 'Aux petits soins', description: 'Terminer des tâches sur 5 jours différents.', kind: 'CARE', target: 5 },
  { key: 'CARE_12_DAYS', title: 'Compagnon du bac', description: 'Terminer des tâches sur 12 jours différents.', kind: 'CARE', target: 12 },
  { key: 'JOURNAL_5_DAYS', title: 'Observateur attentif', description: 'Commenter ses mesures sur 5 jours différents.', kind: 'JOURNAL', target: 5 },
  { key: 'FIRST_PLAN', title: 'Un pas d’avance', description: 'Planifier une tâche pour son bac.', kind: 'PLAN', target: 1 },
  { key: 'FIRST_SOLUTIONS', title: 'Curieux et prudent', description: 'Consulter les conseils Classic de son aquarium.', kind: 'SOLUTIONS', target: 1 },
  { key: 'VISIT_30_DAYS', title: 'Fidèle au rendez-vous', description: 'Consulter le tableau de bord sur 30 jours, pas nécessairement consécutifs.', kind: 'VISIT', target: 30 },
  { key: 'SEVEN_DAY_STREAK', title: 'Présent pour son bac', description: 'Consulter le tableau de bord 7 jours différents dans un même mois.', kind: 'MONTH_VISITS', target: 7 },
  { key: 'MONTH_FOUR_MISSIONS', title: 'Un mois bien accompagné', description: 'Terminer 4 missions pendant le même mois.', kind: 'MISSIONS', target: 4 },
  { key: 'XP_1000', title: 'Aquariophile régulier', description: 'Cumuler 1 000 XP.', kind: 'XP', target: 1000 },
] as const;

export const TITLES = [
  { xp: 0, title: 'Explorateur aquatique' },
  { xp: 300, title: 'Observateur du bac' },
  { xp: 1000, title: 'Gardien attentif' },
  { xp: 2500, title: 'Compagnon des aquariums' },
];

export function parisDay(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type)!.value).join('-');
}

export function monthlyRange(day: string) {
  const [year, month] = day.split('-').map(Number);
  return { weekStart: `${day.slice(0, 7)}-01`, weekEnd: `${day.slice(0, 7)}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}` };
}

export function levelInfo(xp: number) {
  let level = 1, xpForCurrentLevel = 0, xpForNextLevel = 100;
  while (xp >= xpForNextLevel) {
    level++;
    xpForCurrentLevel = xpForNextLevel;
    xpForNextLevel += 100 + level * 50;
  }
  return { level, xpForCurrentLevel, xpForNextLevel };
}

export function badgeProgress(kind: string, total: ActivityCounts, monthly: ActivityCounts, completed: number, xp: number) {
  if (kind === 'MONTH_VISITS') return monthly.VISIT ?? 0;
  if (kind === 'MISSIONS') return completed;
  if (kind === 'XP') return xp;
  return total[kind as ActivityKind] ?? 0;
}
