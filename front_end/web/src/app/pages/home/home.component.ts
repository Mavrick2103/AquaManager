import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService, Me } from '../../core/auth.service';
import { WeekCalendarComponent } from './week-calendar.component';

/* Angular Material */
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule }  from '@angular/material/button';
import { MatIconModule }    from '@angular/material/icon';
import { MatCardModule }    from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule }   from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';

/* Données tâches */
import { TasksService, Task } from '../../core/tasks.service';
import { format, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatToolbarModule, MatButtonModule, MatIconModule,
    MatCardModule, MatDividerModule, MatChipsModule,
    MatTooltipModule, MatMenuModule,
    WeekCalendarComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  private auth = inject(AuthService);
  private tasksApi = inject(TasksService);

  me: Me | null = null;

  // Hover timers pour le menu profil
  private openTimer: any;
  private closeTimer: any;

  // KPI du jour
  today = new Date();
  todayTasksCount = 0;

  // ✅ KPI “Mesures d’eau ce mois-ci”
  monthlyWaterTestsCount = 0;

  // Listes pour les cartes "Activités"
  latestActivities: Task[] = [];  // dernières activités (max 5)
  upcomingTasks: Task[] = [];     // à venir (7 jours, max 5)

  async ngOnInit() {
    this.me = await this.auth.fetchMe();

    const now = new Date();
    const monthStr = format(now, 'yyyy-MM');
    const todayIso = format(now, 'yyyy-MM-dd');
    const past7 = addDays(now, -7);
    const in7 = addDays(now, 7);

    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    this.tasksApi.list(monthStr).subscribe((tasks: Task[]) => {
      const safe = tasks || [];

      // ---- KPI “Tâches aujourd’hui”
      const todays = safe.filter(t => t?.dueAt?.startsWith(todayIso));
      this.todayTasksCount = todays.length;

      // ---- KPI “Mesures d’eau ce mois-ci” (toutes tâches WATER_TEST du mois)
      const monthTests = safe.filter(t => {
        if (t.type !== 'WATER_TEST' || !t.dueAt) return false;
        const d = new Date(t.dueAt);
        return d >= monthStart && d <= monthEnd;
      });
      this.monthlyWaterTestsCount = monthTests.length;

      // ---- Dernières activités (7 derniers jours, ou marquées faites)
      this.latestActivities = [...safe]
        .filter(t => {
          if (!t?.dueAt) return false;
          const doneAt = (t as any).doneAt ? new Date((t as any).doneAt) : null;
          const ref = doneAt ?? new Date(t.dueAt);
          return ref <= now && ref >= past7;
        })
        // Remonter les mesures d’eau
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

      // ---- Activités à venir (prochaines 7 jours, max 5)
      this.upcomingTasks = safe
        .filter(t => {
          if (!t?.dueAt) return false;
          const d = new Date(t.dueAt);
          return d >= now && d <= in7;
        })
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
        .slice(0, 5);
    });
  }

  // ===== Helpers UI =====
  typeIcon(type?: string) {
    switch (type) {
      case 'WATER_CHANGE':   return 'opacity';
      case 'FERTILIZATION':  return 'eco';
      case 'TRIM':           return 'content_cut';
      case 'WATER_TEST':     return 'science';
      default:               return 'task_alt';
    }
  }

  typeLabel(type?: string) {
    switch (type) {
      case 'WATER_CHANGE':   return 'Changement d’eau';
      case 'FERTILIZATION':  return 'Fertilisation';
      case 'TRIM':           return 'Entretien/Taille';
      case 'WATER_TEST':     return 'Test de l’eau';
      default:               return 'Tâche';
    }
  }

  whenLabel(t: Task) {
    const doneAt = (t as any).doneAt ? new Date((t as any).doneAt) : null;
    const ref = doneAt ?? (t.dueAt ? new Date(t.dueAt) : this.today);
    return format(ref, "EEE d MMM HH:mm", { locale: fr });
  }

  logout() { this.auth.logout(); }

  openMenu(trigger: MatMenuTrigger) {
    clearTimeout(this.closeTimer);
    this.openTimer = setTimeout(() => trigger.openMenu(), 100);
  }
  keepOpen(_trigger: MatMenuTrigger) {
    clearTimeout(this.closeTimer);
  }
  closeMenu(trigger: MatMenuTrigger) {
    clearTimeout(this.openTimer);
    this.closeTimer = setTimeout(() => trigger.closeMenu(), 150);
  }
}
