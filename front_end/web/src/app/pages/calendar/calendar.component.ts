import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';
import { TasksService, Task } from '../../core/tasks.service';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TaskDialogComponent } from './task-dialog/task-dialog.component';
import { DayTasksDialogComponent } from './day-tasks-dialog/day-tasks-dialog.component';
import { format, startOfMonth, endOfMonth, startOfWeek, addDays, addMonths, isSameMonth, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { RouterLink } from '@angular/router';
import { MatDividerModule } from '@angular/material/divider';


@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDialogModule, RouterLink, MatDividerModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss'],
})
export class CalendarComponent {
  private tasksApi = inject(TasksService);
  private dialog = inject(MatDialog);
  private title = inject(Title);
  private meta = inject(Meta);

  today = new Date();
  currentMonth = signal(new Date(this.today.getFullYear(), this.today.getMonth(), 1));
  tasks = signal<Task[]>([]);

  weeks = computed(() => {
    const monthStart = startOfMonth(this.currentMonth());
    const monthEnd = endOfMonth(monthStart);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // lundi
    const days: Date[] = [];
    let d = gridStart;
    while (d <= monthEnd || days.length % 7 !== 0) {
      days.push(d);
      d = addDays(d, 1);
    }
    return Array.from({ length: Math.ceil(days.length / 7) }, (_, i) => days.slice(i * 7, i * 7 + 7));
  });

  constructor() {
    this.title.setTitle('Calendrier – AquaManager');
    this.meta.updateTag({
      name: 'description',
      content: 'Planifiez vos tâches d’aquarium : changements d’eau, fertilisation, entretien…'
    });

    effect(() => {
      const monthStr = format(this.currentMonth(), 'yyyy-MM');
      this.tasksApi.list(monthStr).subscribe(res => this.tasks.set(res));
    });
  }

  prevMonth() { this.currentMonth.set(addMonths(this.currentMonth(), -1)); }
  nextMonth() { this.currentMonth.set(addMonths(this.currentMonth(), 1)); }
  thisMonth() { this.currentMonth.set(new Date(this.today.getFullYear(), this.today.getMonth(), 1)); }

  /** Bouton de la toolbar (ouvre ton ancien créateur complet à aujourd’hui) */
  openCreateQuick(): void {
    this.dialog.open(TaskDialogComponent, {
      width: '420px',
      data: { date: this.today },
      autoFocus: 'dialog'
    }).afterClosed().subscribe(createdOrChanged => {
      if (createdOrChanged) this.reloadMonth();
    });
  }

  /** Clic sur une cellule -> ouvre la fenêtre des tâches du jour */
  openDayTasks(day: Date) {
    const dayTasks = this.dayTasks(day);

    this.dialog.open(DayTasksDialogComponent, {
      width: '720px',
      data: { date: day, tasks: dayTasks },
      autoFocus: 'dialog'
    }).afterClosed().subscribe(changed => {
      if (changed) this.reloadMonth();
    });
  }

  /** (Optionnel) Garde ta méthode d’ouverture du créateur complet pour un jour donné */
  openCreate(day: Date) {
    this.dialog.open(TaskDialogComponent, {
      width: '420px',
      data: { date: day },
      autoFocus: 'dialog'
    }).afterClosed().subscribe(created => {
      if (created) this.reloadMonth();
    });
  }

  private reloadMonth() {
    const monthStr = format(this.currentMonth(), 'yyyy-MM');
    this.tasksApi.list(monthStr).subscribe(res => this.tasks.set(res));
  }

  dayTasks(d: Date) {
    const iso = format(d, 'yyyy-MM-dd');
    return this.tasks().filter(t => t.dueAt.startsWith(iso));
  }

  fmt(d: Date, pattern: string) { return format(d, pattern, { locale: fr }); }
  isSameMonth(d: Date) { return isSameMonth(d, this.currentMonth()); }
  isToday(d: Date) { return isSameDay(d, this.today); }
}
