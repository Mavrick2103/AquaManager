import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { Aquarium } from '../../../../core/aquariums.service';
import {
  CreateTaskPayload,
  RepeatMode,
  Task,
  TaskType,
  TasksService,
  WeekDayKey,
} from '../../../../core/tasks.service';

type ProtocolKey = 'ROUTINE' | 'STARTUP' | 'ALGAE' | 'VACATION';

type ProtocolStep = {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  offsetDays: number;
  repeatMode?: RepeatMode;
  repeatWeeks?: number;
};

type ProtocolDefinition = {
  key: ProtocolKey;
  icon: string;
  title: string;
  subtitle: string;
  duration: string;
  tone: 'blue' | 'green' | 'amber' | 'purple';
  recommended: boolean;
  reason: string;
  steps: ProtocolStep[];
};

type ActiveProtocol = {
  key: ProtocolKey;
  title: string;
  icon: string;
  tone: ProtocolDefinition['tone'];
  tasks: Task[];
};

@Component({
  selector: 'app-aquarium-protocols',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './aquarium-protocols.component.html',
  styleUrl: './aquarium-protocols.component.scss',
})
export class AquariumProtocolsComponent implements OnInit, OnChanges {
  @Input({ required: true }) aquarium!: Aquarium;
  @Input() fishCount = 0;
  @Input() plantCount = 0;
  @Input() initialProtocolKey: ProtocolKey | null = null;

  private readonly tasksService = inject(TasksService);
  private readonly snack = inject(MatSnackBar);

  protocols: ProtocolDefinition[] = [];
  selectedProtocol: ProtocolDefinition | null = null;
  selectedSteps = new Set<string>();
  existingProtocolKeys = new Set<ProtocolKey>();
  activeProtocols: ActiveProtocol[] = [];
  startDate = this.toDateInput(new Date());
  absenceDepartureDate = this.toDateInput(this.addDays(new Date(), 7));
  absenceReturnDate = this.toDateInput(this.addDays(new Date(), 14));
  loading = true;
  creating = false;
  deletingProtocolKey: ProtocolKey | null = null;
  deletingTaskId: string | number | null = null;
  editingTaskId: string | number | null = null;
  editDueAt = '';
  editDescription = '';
  savingTask = false;

  ngOnInit(): void {
    this.rebuildProtocols();
    if (this.initialProtocolKey) {
      const initial = this.protocols.find((protocol) => protocol.key === this.initialProtocolKey);
      if (initial) this.selectProtocol(initial);
    }
    void this.loadExistingProtocols();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['aquarium'] || changes['fishCount'] || changes['plantCount']) {
      this.rebuildProtocols();
    }
  }

  selectProtocol(protocol: ProtocolDefinition): void {
    if (this.creating) return;
    this.selectedProtocol = protocol;
    this.selectedSteps = new Set(this.previewSteps.map((step) => step.id));
  }

  closePreview(): void {
    if (!this.creating) this.selectedProtocol = null;
  }

  toggleStep(stepId: string, checked: boolean): void {
    const next = new Set(this.selectedSteps);
    checked ? next.add(stepId) : next.delete(stepId);
    this.selectedSteps = next;
  }

  get previewSteps(): ProtocolStep[] {
    const protocol = this.selectedProtocol;
    if (!protocol) return [];
    if (protocol.key !== 'VACATION') return protocol.steps;

    return protocol.steps.filter(
      (step) => step.id !== 'vacation-midpoint' || this.absenceDurationDays >= 7,
    );
  }

  get absenceDurationDays(): number {
    const departure = this.parseDateInput(this.absenceDepartureDate);
    const returned = this.parseDateInput(this.absenceReturnDate);
    if (!departure || !returned) return 0;
    return Math.max(0, Math.round((returned.getTime() - departure.getTime()) / 86400000));
  }

  get minimumReturnDate(): string {
    const departure = this.parseDateInput(this.absenceDepartureDate) ?? new Date();
    return this.toDateInput(this.addDays(departure, 1));
  }

  onAbsenceDatesChange(): void {
    const departure = this.parseDateInput(this.absenceDepartureDate);
    const returned = this.parseDateInput(this.absenceReturnDate);
    if (departure && (!returned || returned <= departure)) {
      this.absenceReturnDate = this.toDateInput(this.addDays(departure, 7));
    }

    const visibleIds = new Set(this.previewSteps.map((step) => step.id));
    const next = new Set([...this.selectedSteps].filter((id) => visibleIds.has(id)));
    for (const id of visibleIds) next.add(id);
    this.selectedSteps = next;
  }

  isExisting(key: ProtocolKey): boolean {
    return this.existingProtocolKeys.has(key);
  }

  async activateProtocol(): Promise<void> {
    const protocol = this.selectedProtocol;
    if (!protocol || !this.selectedSteps.size || this.creating) return;
    if (this.isExisting(protocol.key)) {
      this.snack.open(
        'Ce protocole est déjà présent dans le planning. Modifie ses tâches depuis le calendrier.',
        'Fermer',
        { duration: 5000 },
      );
      return;
    }

    const selected = this.previewSteps.filter((step) => this.selectedSteps.has(step.id));
    const created: Task[] = [];
    this.creating = true;

    try {
      for (const step of selected) {
        const payload = this.toTaskPayload(protocol, step);
        created.push(await firstValueFrom(this.tasksService.create(payload)));
      }

      this.existingProtocolKeys.add(protocol.key);
      this.selectedProtocol = null;
      await this.loadExistingProtocols();
      this.snack.open(
        `${created.length} étape${created.length > 1 ? 's' : ''} ajoutée${created.length > 1 ? 's' : ''} au planning`,
        'Voir le calendrier',
        { duration: 5000 },
      ).onAction().subscribe(() => {
        window.location.assign('/calendar');
      });
    } catch {
      await Promise.allSettled(
        created
          .filter((task) => !task.virtual)
          .map((task) => firstValueFrom(this.tasksService.delete(task.id))),
      );
      this.snack.open(
        'Le protocole n’a pas pu être créé. Aucune étape incomplète n’a été conservée.',
        'Fermer',
        { duration: 6000 },
      );
    } finally {
      this.creating = false;
    }
  }

  startTaskEdit(task: Task): void {
    if (this.savingTask) return;
    this.editingTaskId = task.id;
    this.editDueAt = this.toDateTimeInput(task.dueAt);
    this.editDescription = this.cleanProtocolDescription(task.description);
  }

  cancelTaskEdit(): void {
    if (this.savingTask) return;
    this.editingTaskId = null;
    this.editDueAt = '';
    this.editDescription = '';
  }

  async saveTaskEdit(task: Task): Promise<void> {
    if (!this.editDueAt || this.savingTask) return;
    const protocol = this.protocolKeyFromTask(task);
    if (!protocol) return;

    this.savingTask = true;
    try {
      const dueAt = new Date(this.editDueAt);
      const marker = `[AquaManager protocol:${protocol}]`;
      await firstValueFrom(
        this.tasksService.update(task.id, {
          dueAt: dueAt.toISOString(),
          description: `${marker}\n${this.editDescription.trim()}`,
          repeat: task.repeat ?? null,
        }),
      );
      await this.loadExistingProtocols();
      this.editingTaskId = null;
      this.editDueAt = '';
      this.editDescription = '';
      this.snack.open('Étape mise à jour', 'OK', { duration: 2500 });
    } catch {
      this.snack.open('Impossible de modifier cette étape', 'Fermer', { duration: 4000 });
    } finally {
      this.savingTask = false;
    }
  }

  async deleteTask(task: Task): Promise<void> {
    if (
      this.deletingTaskId !== null ||
      !window.confirm(`Supprimer l’étape « ${task.title} » de ce protocole ?`)
    ) {
      return;
    }

    this.deletingTaskId = task.id;
    try {
      await firstValueFrom(this.tasksService.delete(task.id));
      await this.loadExistingProtocols();
      this.snack.open('Étape supprimée', 'OK', { duration: 2500 });
    } catch {
      this.snack.open('Impossible de supprimer cette étape', 'Fermer', { duration: 4000 });
    } finally {
      this.deletingTaskId = null;
    }
  }

  async deleteProtocol(protocol: ActiveProtocol): Promise<void> {
    if (
      this.deletingProtocolKey ||
      !window.confirm(
        `Supprimer le protocole « ${protocol.title} » et ses ${protocol.tasks.length} étape${protocol.tasks.length > 1 ? 's' : ''} du planning ?`,
      )
    ) {
      return;
    }

    this.deletingProtocolKey = protocol.key;
    const failures: Task[] = [];
    for (const task of protocol.tasks) {
      try {
        await firstValueFrom(this.tasksService.delete(task.id));
      } catch {
        failures.push(task);
      }
    }

    await this.loadExistingProtocols();
    this.deletingProtocolKey = null;
    if (failures.length) {
      this.snack.open(
        `${failures.length} étape${failures.length > 1 ? 's' : ''} n’a pas pu être supprimée.`,
        'Fermer',
        { duration: 5000 },
      );
    } else {
      this.snack.open('Protocole supprimé du planning', 'OK', { duration: 3000 });
    }
  }

  cleanProtocolDescription(description?: string): string {
    return (description ?? '')
      .replace(/\[AquaManager protocol:(ROUTINE|STARTUP|ALGAE|VACATION)\]\s*/g, '')
      .trim();
  }

  taskRepeatLabel(task: Task): string | null {
    if (!task.repeat) return null;
    if (task.repeat.mode === 'WEEKLY') return 'Chaque semaine';
    if (task.repeat.mode === 'EVERY_X_WEEKS') return 'Toutes les 2 semaines';
    if (task.repeat.mode === 'EVERY_2_DAYS') return 'Tous les 2 jours';
    if (task.repeat.mode === 'DAILY') return 'Chaque jour';
    return null;
  }

  protocolProgress(protocol: ActiveProtocol): number {
    if (!protocol.tasks.length) return 0;
    const completed = protocol.tasks.filter((task) => task.status === 'DONE').length;
    return Math.round((completed / protocol.tasks.length) * 100);
  }

  stepDateLabel(step: ProtocolStep): string {
    const date = this.dateForStep(step);
    const base = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(date);

    if (!step.repeatMode) return base;
    if (step.repeatMode === 'WEEKLY') return `${base}, puis chaque semaine`;
    if (step.repeatMode === 'EVERY_X_WEEKS') return `${base}, puis toutes les 2 semaines`;
    if (step.repeatMode === 'EVERY_2_DAYS') return `${base}, puis tous les 2 jours`;
    return base;
  }

  private async loadExistingProtocols(): Promise<void> {
    this.loading = true;
    try {
      const tasks = await firstValueFrom(this.tasksService.list());
      const keys = new Set<ProtocolKey>();
      const grouped = new Map<ProtocolKey, Task[]>();
      for (const task of tasks) {
        if (Number(task.aquarium?.id) !== Number(this.aquarium.id)) continue;
        const key = this.protocolKeyFromTask(task);
        if (!key) continue;
        keys.add(key);
        grouped.set(key, [...(grouped.get(key) ?? []), task]);
      }
      this.existingProtocolKeys = keys;
      this.activeProtocols = [...grouped.entries()]
        .map(([key, protocolTasks]) => {
          const definition = this.protocols.find((protocol) => protocol.key === key);
          return {
            key,
            title: definition?.title ?? key,
            icon: definition?.icon ?? 'route',
            tone: definition?.tone ?? 'blue',
            tasks: [...protocolTasks].sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
          };
        })
        .sort((a, b) => a.tasks[0].dueAt.localeCompare(b.tasks[0].dueAt));
    } catch {
      // L'indisponibilité du planning ne doit pas masquer les protocoles.
    } finally {
      this.loading = false;
    }
  }

  private protocolKeyFromTask(task: Task): ProtocolKey | null {
    const match = task.description?.match(
      /\[AquaManager protocol:(ROUTINE|STARTUP|ALGAE|VACATION)\]/,
    );
    return match ? (match[1] as ProtocolKey) : null;
  }

  private rebuildProtocols(): void {
    if (!this.aquarium) return;

    const isMarine = this.aquarium.waterType === 'EAU_DE_MER';
    const hasPlants = this.plantCount > 0;
    const isYoung = this.aquarium.startDate
      ? Date.now() - new Date(this.aquarium.startDate).getTime() < 60 * 86400000
      : false;

    const routineSteps: ProtocolStep[] = [
      {
        id: 'routine-test',
        title: 'Contrôler les paramètres de l’eau',
        description: `Mesurer les paramètres essentiels du bac${isMarine ? ' : température, salinité, KH, NO2, NO3, calcium et magnésium.' : ' : température, pH, KH, GH, NO2 et NO3.'}`,
        type: 'WATER_TEST',
        offsetDays: 0,
        repeatMode: 'WEEKLY',
        repeatWeeks: 12,
      },
      {
        id: 'routine-water',
        title: 'Renouveler une partie de l’eau',
        description: `Effectuer un changement adapté au bac${isMarine ? ' en contrôlant la température et la salinité de l’eau neuve.' : ' avec une eau préparée à température proche.'}`,
        type: 'WATER_CHANGE',
        offsetDays: 1,
        repeatMode: 'WEEKLY',
        repeatWeeks: 12,
      },
      {
        id: 'routine-observe',
        title: 'Observer les habitants et le matériel',
        description: 'Vérifier le comportement des habitants, la température, le débit du filtre et l’aspect général du bac.',
        type: 'OTHER',
        offsetDays: 2,
        repeatMode: 'WEEKLY',
        repeatWeeks: 12,
      },
    ];

    if (hasPlants) {
      routineSteps.push({
        id: 'routine-trim',
        title: 'Contrôler et entretenir les plantes',
        description: 'Retirer les feuilles abîmées, vérifier la croissance et tailler uniquement si nécessaire.',
        type: 'TRIM',
        offsetDays: 3,
        repeatMode: 'EVERY_X_WEEKS',
        repeatWeeks: 12,
      });
    }

    this.protocols = [
      {
        key: 'ROUTINE',
        icon: 'event_repeat',
        title: 'Routine d’entretien',
        subtitle: 'Un rythme simple pour garder le bac stable',
        duration: '12 semaines',
        tone: 'blue',
        recommended: !isYoung,
        reason: `${isMarine ? 'Adapté à un aquarium marin' : 'Adapté à un aquarium d’eau douce'}${hasPlants ? ' planté' : ''} de ${Math.round(this.aquarium.volumeL)} L.`,
        steps: routineSteps,
      },
      {
        key: 'STARTUP',
        icon: 'rocket_launch',
        title: 'Démarrage et cyclage',
        subtitle: 'Suivre les premières semaines sans précipiter le vivant',
        duration: '5 semaines',
        tone: 'green',
        recommended: isYoung,
        reason: isYoung
          ? 'Recommandé car ce bac semble avoir été démarré récemment.'
          : 'À utiliser lors d’une remise en route complète du bac.',
        steps: [
          {
            id: 'startup-baseline',
            title: 'Noter les paramètres de départ',
            description: 'Effectuer un relevé initial qui servira de référence pendant le cyclage.',
            type: 'WATER_TEST',
            offsetDays: 0,
          },
          ...[7, 14, 21, 28].map((day, index): ProtocolStep => ({
            id: `startup-test-${index + 1}`,
            title: `Contrôle du cyclage — semaine ${index + 1}`,
            description: `Mesurer en priorité les nitrites et l’ammoniac${isMarine ? ', ainsi que la salinité.' : ', puis le pH et les nitrates.'} Ne pas ajouter d’habitants tant que le cycle n’est pas stable.`,
            type: 'WATER_TEST',
            offsetDays: day,
          })),
          {
            id: 'startup-review',
            title: 'Faire le bilan du cyclage',
            description: 'Comparer les relevés avant toute introduction et prolonger le suivi si des nitrites restent détectables.',
            type: 'OTHER',
            offsetDays: 35,
          },
        ],
      },
      {
        key: 'ALGAE',
        icon: 'grass',
        title: 'Retour à l’équilibre',
        subtitle: 'Observer et agir progressivement face aux algues',
        duration: '3 semaines',
        tone: 'amber',
        recommended: false,
        reason: 'Un protocole prudent qui évite de multiplier les changements en même temps.',
        steps: [
          {
            id: 'algae-photo',
            title: 'Documenter le problème',
            description: 'Prendre une photo, noter les zones touchées et vérifier la durée d’éclairage avant d’intervenir.',
            type: 'OTHER',
            offsetDays: 0,
          },
          {
            id: 'algae-test',
            title: 'Mesurer avant intervention',
            description: 'Contrôler NO3, PO4 et les paramètres essentiels pour disposer d’un point de comparaison fiable.',
            type: 'WATER_TEST',
            offsetDays: 0,
          },
          {
            id: 'algae-clean',
            title: 'Retirer manuellement les algues',
            description: 'Nettoyer progressivement les zones atteintes sans bouleverser tout l’équilibre du bac.',
            type: 'TRIM',
            offsetDays: 1,
          },
          {
            id: 'algae-water',
            title: 'Effectuer un changement d’eau raisonné',
            description: 'Renouveler une partie de l’eau et retirer les déchets libérés pendant le nettoyage.',
            type: 'WATER_CHANGE',
            offsetDays: 1,
          },
          {
            id: 'algae-followup',
            title: 'Contrôler l’évolution',
            description: 'Reprendre une photo et les mêmes mesures pour vérifier si la situation s’améliore.',
            type: 'WATER_TEST',
            offsetDays: 7,
            repeatMode: 'WEEKLY',
            repeatWeeks: 3,
          },
        ],
      },
      {
        key: 'VACATION',
        icon: 'luggage',
        title: 'Préparer une absence',
        subtitle: 'Sécuriser le bac avant de partir',
        duration: 'Avant le départ',
        tone: 'purple',
        recommended: false,
        reason: `Préparation adaptée à un bac de ${Math.round(this.aquarium.volumeL)} L${this.fishCount ? ` avec ${this.fishCount} groupe${this.fishCount > 1 ? 's' : ''} d’habitants` : ''}.`,
        steps: [
          {
            id: 'vacation-check',
            title: 'Faire le contrôle avant départ',
            description: 'Tester l’eau, vérifier la température et corriger un éventuel problème plusieurs jours avant le départ.',
            type: 'WATER_TEST',
            offsetDays: -3,
          },
          {
            id: 'vacation-equipment',
            title: 'Vérifier le matériel et les minuteries',
            description: 'Contrôler filtre, chauffage, éclairage, niveau d’eau et alimentation automatique sans modifier brutalement les réglages.',
            type: 'OTHER',
            offsetDays: -2,
          },
          {
            id: 'vacation-water',
            title: 'Faire l’entretien avant absence',
            description: 'Réaliser l’entretien habituel et un changement d’eau raisonnable, sans nettoyage excessif du filtre.',
            type: 'WATER_CHANGE',
            offsetDays: -1,
          },
          {
            id: 'vacation-midpoint',
            title: 'Faire vérifier le bac pendant l’absence',
            description: 'Demander à une personne de confiance de contrôler visuellement les habitants, la température, le filtre et le niveau d’eau, sans modifier les réglages.',
            type: 'OTHER',
            offsetDays: 0,
          },
          {
            id: 'vacation-return',
            title: 'Contrôler le bac au retour',
            description: 'Observer les habitants et le matériel, puis mesurer l’eau avant de reprendre la routine normale.',
            type: 'WATER_TEST',
            offsetDays: 0,
          },
        ],
      },
    ];

    if (this.selectedProtocol) {
      this.selectedProtocol =
        this.protocols.find((protocol) => protocol.key === this.selectedProtocol?.key) ?? null;
    }
  }

  private toTaskPayload(protocol: ProtocolDefinition, step: ProtocolStep): CreateTaskPayload {
    const dueDate = this.dateForStep(step);
    dueDate.setHours(9, 0, 0, 0);
    const marker = `[AquaManager protocol:${protocol.key}]`;

    return {
      aquariumId: this.aquarium.id,
      title: step.title,
      description: `${marker}\n${step.description}`,
      dueAt: dueDate.toISOString(),
      type: step.type,
      repeat: step.repeatMode
        ? {
            mode: step.repeatMode,
            durationWeeks: step.repeatWeeks,
            everyWeeks: step.repeatMode === 'EVERY_X_WEEKS' ? 2 : undefined,
            days:
              step.repeatMode === 'WEEKLY' || step.repeatMode === 'EVERY_X_WEEKS'
                ? [this.weekDayKey(dueDate)]
                : undefined,
          }
        : null,
    };
  }

  private dateWithOffset(offsetDays: number): Date {
    const parsed = new Date(`${this.startDate}T12:00:00`);
    const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    date.setDate(date.getDate() + offsetDays);
    return date;
  }

  private dateForStep(step: ProtocolStep): Date {
    if (this.selectedProtocol?.key !== 'VACATION') {
      return this.dateWithOffset(step.offsetDays);
    }

    const departure = this.parseDateInput(this.absenceDepartureDate) ?? new Date();
    const returned = this.parseDateInput(this.absenceReturnDate) ?? this.addDays(departure, 7);

    if (step.id === 'vacation-return') return returned;
    if (step.id === 'vacation-midpoint') {
      return this.addDays(departure, Math.max(1, Math.floor(this.absenceDurationDays / 2)));
    }
    return this.addDays(departure, step.offsetDays);
  }

  private parseDateInput(value: string): Date | null {
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private weekDayKey(date: Date): WeekDayKey {
    return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getDay()] as WeekDayKey;
  }

  private toDateInput(date: Date): string {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  private toDateTimeInput(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }
}
