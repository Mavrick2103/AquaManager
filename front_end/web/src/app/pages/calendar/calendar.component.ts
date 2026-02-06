import { Component, computed, effect, inject, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { MatDividerModule } from '@angular/material/divider';

import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  addDays,
  addMonths,
  isSameMonth,
  isSameDay,
} from 'date-fns';
import { fr } from 'date-fns/locale';

import { TasksService, Task, CreateTaskPayload } from '../../core/tasks.service';
import { TaskDialogComponent } from './task-dialog/task-dialog.component';
import { DayTasksDialogComponent } from './day-tasks-dialog/day-tasks-dialog.component';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
    RouterLink,
    MatDividerModule,
  ],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss'],
  encapsulation: ViewEncapsulation.None,
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

    return Array.from({ length: Math.ceil(days.length / 7) }, (_, i) =>
      days.slice(i * 7, i * 7 + 7),
    );
  });

  constructor() {
    this.title.setTitle('Calendrier – AquaManager');
    this.meta.updateTag({
      name: 'description',
      content: 'Planifiez vos tâches d’aquarium : changements d’eau, fertilisation, entretien…',
    });

    effect(() => {
      this.reloadMonth();
    });
  }

  prevMonth() {
    this.currentMonth.set(addMonths(this.currentMonth(), -1));
  }
  nextMonth() {
    this.currentMonth.set(addMonths(this.currentMonth(), 1));
  }
  thisMonth() {
    this.currentMonth.set(new Date(this.today.getFullYear(), this.today.getMonth(), 1));
  }

  openCreateQuick(): void {
    this.openCreate(this.today);
  }

  openCreate(day: Date) {
    this.dialog
      .open(TaskDialogComponent, {
        data: { date: day },
        autoFocus: false,
        restoreFocus: false,
        width: 'min(1100px, 96vw)',
        maxHeight: '82vh',
        panelClass: 'task-dialog-panel',
      })
      .afterClosed()
      .subscribe((payload: CreateTaskPayload | null | undefined) => {
        if (!payload) return;

        // ✅ ICI on enregistre vraiment en base
        this.tasksApi.create(payload).subscribe({
          next: () => this.reloadMonth(),
          error: (err) => {
            console.error('Create task failed:', err);
            alert('Erreur lors de la création de la tâche (voir console).');
          },
        });
      });
  }

  openDayTasks(day: Date) {
    const dayTasks = this.dayTasks(day);

    this.dialog
      .open(DayTasksDialogComponent, {
        data: { date: day, tasks: dayTasks },
        autoFocus: false,
        restoreFocus: false,
        width: 'min(980px, 92vw)',
        maxHeight: '86vh',
        panelClass: 'day-tasks-dialog-panel',
      })
      .afterClosed()
      .subscribe((changed) => {
        if (changed) this.reloadMonth();
      });
  }

  private reloadMonth() {
    const monthStr = format(this.currentMonth(), 'yyyy-MM');
    this.tasksApi.list(monthStr).subscribe({
      next: (res) => this.tasks.set(res ?? []),
      error: (err) => {
        console.error('Load tasks failed:', err);
        this.tasks.set([]);
      },
    });
  }

  dayTasks(d: Date) {
    const iso = format(d, 'yyyy-MM-dd');
    return this.tasks().filter((t) => t.dueAt.startsWith(iso));
  }

  fmt(d: Date, pattern: string) {
    return format(d, pattern, { locale: fr });
  }
  isSameMonth(d: Date) {
    return isSameMonth(d, this.currentMonth());
  }
  isToday(d: Date) {
    return isSameDay(d, this.today);
  }
}
