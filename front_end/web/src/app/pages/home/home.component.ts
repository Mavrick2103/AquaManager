import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { AuthService, Me } from '../../core/auth.service';
import { WeekCalendarComponent } from './week-calendar.component';

/* Angular Material */
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';

/* Données */
import { TasksService, Task } from '../../core/tasks.service';
import { AquariumsService, Aquarium } from '../../core/aquariums.service';
import { MeasurementsService, Measurement } from '../../core/water.service';

import {
  GamificationService,
  GamificationSummary,
  AquariumHealthStatus,
  AquariumScoreMode,
} from '../../core/gamification.service';

import { format, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,

    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatDividerModule,
    MatChipsModule,
    MatTooltipModule,
    MatMenuModule,
    MatProgressBarModule,

    WeekCalendarComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  private auth = inject(AuthService);
  private tasksApi = inject(TasksService);
  private aquariumsApi = inject(AquariumsService);
  private measApi = inject(MeasurementsService);
  private gamificationApi = inject(GamificationService);

  me: Me | null = null;
  userFullName = '';

  private openTimer: ReturnType<typeof setTimeout> | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  today = new Date();

  todayTasksCount = 0;
  monthlyMeasurementsCount = 0;

  latestActivities: Task[] = [];
  upcomingTasks: Task[] = [];

  gamificationLoading = true;
  gamification: GamificationSummary | null = null;

  async ngOnInit() {
    try {
      this.me = await this.auth.fetchMe();

      const rawFullName = (this.me?.fullName ?? '').trim();

      this.userFullName = rawFullName.length
        ? rawFullName
        : (this.me?.email?.split('@')[0] ?? '');
    } catch {
      this.me = null;
      this.userFullName = '';
    }

    await Promise.all([
      this.loadHomeData(),
      this.loadGamification(),
    ]);
  }

  private async loadHomeData() {
    const now = new Date();
    const monthStr = format(now, 'yyyy-MM');
    const todayIso = format(now, 'yyyy-MM-dd');
    const past7 = addDays(now, -7);
    const in7 = addDays(now, 7);

    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    this.tasksApi.list(monthStr).subscribe({
      next: (tasks: Task[]) => {
        const safe = tasks || [];

        const todays = safe.filter((t) => t?.dueAt?.startsWith(todayIso));
        this.todayTasksCount = todays.length;

        this.latestActivities = [...safe]
          .filter((t) => {
            if (!t?.dueAt) return false;

            const doneAt = (t as any).doneAt ? new Date((t as any).doneAt) : null;
            const ref = doneAt ?? new Date(t.dueAt);

            return ref <= now && ref >= past7;
          })
          .sort((a, b) => {
            const aRef = (a as any).doneAt ? new Date((a as any).doneAt) : new Date(a.dueAt);
            const bRef = (b as any).doneAt ? new Date((b as any).doneAt) : new Date(b.dueAt);

            const byDateDesc = bRef.getTime() - aRef.getTime();
            if (byDateDesc !== 0) return byDateDesc;

            const aBoost = a.type === 'WATER_TEST' ? 1 : 0;
            const bBoost = b.type === 'WATER_TEST' ? 1 : 0;

            return bBoost - aBoost;
          })
          .slice(0, 5);

        this.upcomingTasks = safe
          .filter((t) => {
            if (!t?.dueAt) return false;

            const d = new Date(t.dueAt);
            return d >= now && d <= in7;
          })
          .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
          .slice(0, 5);
      },
      error: () => {
        this.todayTasksCount = 0;
        this.latestActivities = [];
        this.upcomingTasks = [];
      },
    });

    try {
      const aquariums: Aquarium[] = await firstValueFrom(this.aquariumsApi.listMine());

      const allArrays: Measurement[][] = await Promise.all(
        (aquariums || []).map((aq) => this.measApi.listForAquarium(aq.id))
      );

      const all = allArrays.flat();

      this.monthlyMeasurementsCount = all.filter((m) => {
        const d = new Date(m.measuredAt);
        return d >= monthStart && d <= monthEnd;
      }).length;
    } catch {
      this.monthlyMeasurementsCount = 0;
    }
  }

  private async loadGamification() {
    this.gamificationLoading = true;

    try {
      this.gamification = await this.gamificationApi.getSummary();
    } catch (e) {
      console.error('Erreur chargement gamification', e);
      this.gamification = null;
    } finally {
      this.gamificationLoading = false;
    }
  }

  get xpPercent(): number {
    const p = this.gamification?.profile;
    if (!p) return 0;

    const current = p.xpForCurrentLevel ?? 0;
    const next = p.xpForNextLevel ?? 0;
    const total = next - current;

    if (total <= 0) return 100;

    const value = ((p.xp - current) / total) * 100;

    return Math.max(0, Math.min(100, Math.round(value)));
  }

  get xpToNextLevel(): number {
    const p = this.gamification?.profile;
    if (!p) return 0;

    return Math.max(0, (p.xpForNextLevel ?? 0) - p.xp);
  }

  get topAquariums() {
    return [...(this.gamification?.aquariums ?? [])]
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }

  get activeMissions() {
    return (this.gamification?.missions ?? [])
      .filter((m) => m.status === 'ACTIVE' || m.status === 'COMPLETED')
      .slice(0, 3);
  }

  scoreModeLabel(mode?: AquariumScoreMode): string {
    return mode === 'HEALTH' ? 'Score santé' : 'Score de suivi';
  }

  statusLabel(status?: AquariumHealthStatus): string {
    switch (status) {
      case 'STABLE':
        return 'Stable';
      case 'WATCH':
        return 'À surveiller';
      case 'CRITICAL':
        return 'Critique';
      default:
        return 'À compléter';
    }
  }

  statusIcon(status?: AquariumHealthStatus): string {
    switch (status) {
      case 'STABLE':
        return 'check_circle';
      case 'WATCH':
        return 'visibility';
      case 'CRITICAL':
        return 'warning';
      default:
        return 'info';
    }
  }

  scoreClass(status?: AquariumHealthStatus): string {
    switch (status) {
      case 'STABLE':
        return 'score--stable';
      case 'WATCH':
        return 'score--watch';
      case 'CRITICAL':
        return 'score--critical';
      default:
        return 'score--unknown';
    }
  }

  missionPercent(mission: { progress: number; target: number }): number {
    if (!mission.target || mission.target <= 0) return 0;

    return Math.max(
      0,
      Math.min(100, Math.round((mission.progress / mission.target) * 100))
    );
  }

  badgeLabel(key?: string | null): string {
    switch (key) {
      case 'FIRST_MEASUREMENT':
        return 'Première mesure';
      case 'SEVEN_DAY_STREAK':
        return '7 jours de suivi';
      case 'BAC_STABLE':
        return 'Bac stable';
      case 'XP_1000':
        return 'Aquariophile régulier';
      default:
        return 'Aucun badge récent';
    }
  }

  typeIcon(type?: string) {
    switch (type) {
      case 'WATER_CHANGE':
        return 'opacity';
      case 'FERTILIZATION':
        return 'eco';
      case 'TRIM':
        return 'content_cut';
      case 'WATER_TEST':
        return 'science';
      default:
        return 'task_alt';
    }
  }

  typeLabel(type?: string) {
    switch (type) {
      case 'WATER_CHANGE':
        return 'Changement d’eau';
      case 'FERTILIZATION':
        return 'Fertilisation';
      case 'TRIM':
        return 'Entretien/Taille';
      case 'WATER_TEST':
        return 'Test de l’eau';
      default:
        return 'Tâche';
    }
  }

  whenLabel(t: Task) {
    const doneAt = (t as any).doneAt ? new Date((t as any).doneAt) : null;
    const ref = doneAt ?? (t.dueAt ? new Date(t.dueAt) : this.today);

    return format(ref, 'EEE d MMM HH:mm', { locale: fr });
  }

  logout() {
    this.auth.logout();
  }

  openMenu(trigger: MatMenuTrigger) {
    if (this.closeTimer) clearTimeout(this.closeTimer);

    this.openTimer = setTimeout(() => trigger.openMenu(), 100);
  }

  keepOpen(_trigger: MatMenuTrigger) {
    if (this.closeTimer) clearTimeout(this.closeTimer);
  }

  closeMenu(trigger: MatMenuTrigger) {
    if (this.openTimer) clearTimeout(this.openTimer);

    this.closeTimer = setTimeout(() => trigger.closeMenu(), 150);
  }
}