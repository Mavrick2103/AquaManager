import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WeeklyMission } from '../entities/weekly-mission.entity';

type MissionSeed = {
  missionKey: string;
  title: string;
  description: string;
  target: number;
  xpReward: number;
};

const MISSIONS_PER_PERIOD = 4;
const TEST_REGENERATE_MISSIONS = false;

const DEFAULT_MISSIONS: MissionSeed[] = [
  {
    missionKey: 'ADD_2_MEASUREMENTS',
    title: 'Ajouter 2 mesures',
    description: 'Ajoute deux mesures pour garder un suivi régulier.',
    target: 2,
    xpReward: 80,
  },
  {
    missionKey: 'ADD_5_MEASUREMENTS',
    title: 'Suivi sérieux',
    description: 'Ajoute cinq mesures sur le mois.',
    target: 5,
    xpReward: 150,
  },
  {
    missionKey: 'OPEN_APP_3_DAYS',
    title: 'Suivre ses bacs 3 jours',
    description: 'Reviens au moins 3 jours pour garder le rythme.',
    target: 3,
    xpReward: 60,
  },
  {
    missionKey: 'OPEN_APP_7_DAYS',
    title: 'Aquariophile régulier',
    description: 'Connecte-toi 7 jours différents sur sur le mois.',
    target: 7,
    xpReward: 140,
  },
  {
    missionKey: 'KEEP_SCORE_85',
    title: 'Garder un bac > 85/100',
    description: 'Maintiens au moins un aquarium au-dessus de 85 de score.',
    target: 7,
    xpReward: 120,
  },
  {
    missionKey: 'KEEP_SCORE_90',
    title: 'Bac exemplaire',
    description: 'Maintiens au moins un aquarium au-dessus de 90 de score.',
    target: 7,
    xpReward: 180,
  },
  {
    missionKey: 'COMPLETE_2_TASKS',
    title: 'Faire 2 entretiens',
    description: 'Termine deux tâches planifiées.',
    target: 2,
    xpReward: 70,
  },
  {
    missionKey: 'COMPLETE_5_TASKS',
    title: 'Routine d’entretien',
    description: 'Termine cinq tâches planifiées.',
    target: 5,
    xpReward: 140,
  },
  {
    missionKey: 'CREATE_2_TASKS',
    title: 'Préparer son planning',
    description: 'Ajoute deux tâches dans ton calendrier.',
    target: 2,
    xpReward: 70,
  },
  {
    missionKey: 'CREATE_5_TASKS',
    title: 'Planning organisé',
    description: 'Ajoute cinq tâches dans ton calendrier.',
    target: 5,
    xpReward: 130,
  },
  {
    missionKey: 'ADD_WATER_CHANGE_TASK',
    title: 'Prévoir un changement d’eau',
    description: 'Planifie au moins un changement d’eau sur le mois',
    target: 1,
    xpReward: 60,
  },
  {
    missionKey: 'COMPLETE_WATER_CHANGE',
    title: 'Eau renouvelée',
    description: 'Termine une tâche de changement d’eau.',
    target: 1,
    xpReward: 80,
  },
  {
    missionKey: 'ADD_FERTILIZATION_TASK',
    title: 'Préparer la fertilisation',
    description: 'Planifie une fertilisation pour ton aquarium.',
    target: 1,
    xpReward: 60,
  },
  {
    missionKey: 'COMPLETE_FERTILIZATION',
    title: 'Plantes nourries',
    description: 'Termine une tâche de fertilisation.',
    target: 1,
    xpReward: 80,
  },
  {
    missionKey: 'ADD_TRIM_TASK',
    title: 'Prévoir une taille',
    description: 'Planifie une taille ou un entretien des plantes.',
    target: 1,
    xpReward: 60,
  },
  {
    missionKey: 'COMPLETE_TRIM',
    title: 'Aquarium propre',
    description: 'Termine une tâche de taille ou d’entretien.',
    target: 1,
    xpReward: 80,
  },
  {
    missionKey: 'ADD_WATER_TEST_TASK',
    title: 'Prévoir un test d’eau',
    description: 'Planifie un test des paramètres d’eau.',
    target: 1,
    xpReward: 60,
  },
  {
    missionKey: 'COMPLETE_WATER_TEST',
    title: 'Paramètres contrôlés',
    description: 'Termine une tâche de test d’eau.',
    target: 1,
    xpReward: 80,
  },
  {
    missionKey: 'ADD_1_FISH_TO_TANK',
    title: 'Ajouter un habitant',
    description: 'Ajoute un poisson ou vivant dans un aquarium.',
    target: 1,
    xpReward: 80,
  },
  {
    missionKey: 'ADD_3_FISH_TO_TANK',
    title: 'Compléter la population',
    description: 'Ajoute trois poissons ou vivants dans tes aquariums.',
    target: 3,
    xpReward: 130,
  },
  {
    missionKey: 'ADD_1_PLANT_TO_TANK',
    title: 'Ajouter une plante',
    description: 'Ajoute une plante dans un aquarium.',
    target: 1,
    xpReward: 70,
  },
  {
    missionKey: 'ADD_3_PLANTS_TO_TANK',
    title: 'Bac plus planté',
    description: 'Ajoute trois plantes dans tes aquariums.',
    target: 3,
    xpReward: 120,
  },
  {
    missionKey: 'CHECK_ARTICLES',
    title: 'Lire un conseil',
    description: 'Consulte un article de conseils AquaManager.',
    target: 1,
    xpReward: 40,
  },
  {
    missionKey: 'CHECK_SPECIES',
    title: 'Consulter une fiche espèce',
    description: 'Consulte une fiche poisson ou plante.',
    target: 1,
    xpReward: 40,
  },
  {
    missionKey: 'USE_SOLUTIONS_TAB',
    title: 'Analyser ses solutions',
    description: 'Ouvre l’onglet Solutions d’un aquarium.',
    target: 1,
    xpReward: 70,
  },
  {
    missionKey: 'ACCEPT_RECOMMENDATION',
    title: 'Appliquer une recommandation',
    description: 'Accepte une solution proposée par AquaManager.',
    target: 1,
    xpReward: 120,
  },
  {
    missionKey: 'SAVE_CUSTOM_TARGETS',
    title: 'Personnaliser ses objectifs',
    description: 'Modifie les paramètres de référence d’un aquarium.',
    target: 1,
    xpReward: 90,
  },
  {
    missionKey: 'APPLY_SPECIES_TARGETS',
    title: 'Objectifs adaptés aux espèces',
    description: 'Applique les paramètres moyens calculés depuis les espèces du bac.',
    target: 1,
    xpReward: 100,
  },
];
const ENABLED_MISSION_KEYS = new Set([
  'ADD_2_MEASUREMENTS',//ok
  'ADD_5_MEASUREMENTS',//ok

  'OPEN_APP_3_DAYS',//ok
  'OPEN_APP_7_DAYS',//ok

  'CREATE_2_TASKS',//ok
  'CREATE_5_TASKS',//ok

  'ADD_WATER_CHANGE_TASK',//ok
  'ADD_FERTILIZATION_TASK',//ok
  'ADD_TRIM_TASK',//ok
  'ADD_WATER_TEST_TASK',//ok

]);

@Injectable()
export class WeeklyMissionService {
  constructor(
    @InjectRepository(WeeklyMission)
    private readonly missionRepo: Repository<WeeklyMission>,
  ) {}

  async ensureCurrentWeekMissions(userId: number): Promise<WeeklyMission[]> {
    const { weekStart, weekEnd } = this.getCurrentMonthlyRange();

    const existing = await this.missionRepo.find({
      where: { userId, weekStart },
      order: { id: 'ASC' },
    });

    /*if (existing.length) {
      return existing;
    }*/
    if (existing.length && !TEST_REGENERATE_MISSIONS) {
  return existing;
}

if (existing.length && TEST_REGENERATE_MISSIONS) {
  await this.missionRepo.delete({
    userId,
    weekStart,
  });
}

    const availableMissions = DEFAULT_MISSIONS.filter((mission) =>
  ENABLED_MISSION_KEYS.has(mission.missionKey),
);

const selectedMissions = this.pickRandomMissions(availableMissions, MISSIONS_PER_PERIOD);

    //const selectedMissions = this.pickRandomMissions(DEFAULT_MISSIONS, MISSIONS_PER_PERIOD);

    const rows = selectedMissions.map((seed) =>
      this.missionRepo.create({
        userId,
        missionKey: seed.missionKey,
        title: seed.title,
        description: seed.description,
        target: seed.target,
        progress: 0,
        xpReward: seed.xpReward,
        status: 'ACTIVE',
        weekStart,
        weekEnd,
        completedAt: null,
      }),
    );

    return this.missionRepo.save(rows);
  }

  async incrementMission(
    userId: number,
    missionKey: string,
    amount = 1,
  ): Promise<{ completed: WeeklyMission[] }> {
    const missions = await this.ensureCurrentWeekMissions(userId);

    const mission = missions.find(
      (m) => m.missionKey === missionKey && m.status === 'ACTIVE',
    );

    if (!mission) {
      return { completed: [] };
    }

    mission.progress = Math.min(mission.target, mission.progress + amount);

    const completed: WeeklyMission[] = [];

    if (mission.progress >= mission.target) {
      mission.status = 'COMPLETED';
      mission.completedAt = new Date();
      completed.push(mission);
    }

    await this.missionRepo.save(mission);

    return { completed };
  }

  async updateStableScoreMission(userId: number, hasStableAquarium: boolean) {
    if (!hasStableAquarium) {
      return { completed: [] };
    }

    return this.incrementMission(userId, 'KEEP_SCORE_85', 1);
  }

  async updateExcellentScoreMission(userId: number, hasExcellentAquarium: boolean) {
    if (!hasExcellentAquarium) {
      return { completed: [] };
    }

    return this.incrementMission(userId, 'KEEP_SCORE_90', 1);
  }

  async listCurrent(userId: number): Promise<WeeklyMission[]> {
    const missions = await this.ensureCurrentWeekMissions(userId);

    return missions.sort((a, b) => a.id - b.id);
  }

  private pickRandomMissions(
    missions: MissionSeed[],
    count: number,
  ): MissionSeed[] {
    return [...missions]
      .sort(() => Math.random() - 0.5)
      .slice(0, count);
  }

  private getCurrentMonthlyRange() {
  const now = new Date();

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);

  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  monthEnd.setHours(23, 59, 59, 999);

  return {
    weekStart: this.toDateOnly(monthStart),
    weekEnd: this.toDateOnly(monthEnd),
  };
}

  private toDateOnly(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}