import { Component, computed, effect, inject, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { APP_VERSION } from '../../core/app-version';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
  appVersion = APP_VERSION;
  loading = false;
  loadError = false;
  changingTaskId: string | number | null = null;
  viewMode: 'month' | 'list' = 'month';
  aquariumFilter = 'ALL';
  typeFilter: Task['type'] | 'ALL' = 'ALL';
  statusFilter: Task['status'] | 'OVERDUE' | 'ALL' = 'ALL';
  dateFilter: 'ALL' | 'TODAY' = 'ALL';

  readonly taskTypes: Array<{ value: Task['type']; label: string }> = [
    { value: 'WATER_CHANGE', label: 'Changement d’eau' },
    { value: 'FERTILIZATION', label: 'Fertilisation' },
    { value: 'TRIM', label: 'Taille et entretien' },
    { value: 'WATER_TEST', label: 'Test de l’eau' },
    { value: 'OTHER', label: 'Autre' },
  ];


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

  openCreate(day: Date, event?: Event) {
    event?.stopPropagation();
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
    this.loading = true;
    this.loadError = false;
    this.tasksApi.list(monthStr).subscribe({
      next: (res) => {
        this.tasks.set(res ?? []);
        this.loading = false;
      },
      error: (err) => {
        console.error('Load tasks failed:', err);
        this.tasks.set([]);
        this.loading = false;
        this.loadError = true;
      },
    });
  }

  dayTasks(d: Date) {
    const iso = format(d, 'yyyy-MM-dd');
    return this.filteredTasks.filter((t) => t.dueAt.startsWith(iso));
  }

  get filteredTasks(): Task[] {
    return this.tasks().filter(task => {
      if (this.aquariumFilter !== 'ALL' && String(task.aquarium?.id) !== this.aquariumFilter) {
        return false;
      }
      if (this.typeFilter !== 'ALL' && task.type !== this.typeFilter) return false;
      if (this.statusFilter === 'OVERDUE') return this.isOverdue(task);
      if (this.statusFilter !== 'ALL' && task.status !== this.statusFilter) return false;
      if (this.dateFilter === 'TODAY' && !task.dueAt.startsWith(format(this.today, 'yyyy-MM-dd'))) {
        return false;
      }
      return true;
    });
  }

  get aquariumOptions(): Array<{ id: string; name: string }> {
    const aquariums = new Map<string, string>();
    for (const task of this.tasks()) {
      if (task.aquarium?.id == null) continue;
      aquariums.set(String(task.aquarium.id), task.aquarium.name || `Aquarium ${task.aquarium.id}`);
    }
    return [...aquariums.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  get sortedTasks(): Task[] {
    return [...this.filteredTasks].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'PENDING' ? -1 : 1;
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    });
  }

  get pendingCount(): number {
    return this.tasks().filter(task => task.status === 'PENDING').length;
  }

  get overdueCount(): number {
    return this.tasks().filter(task => this.isOverdue(task)).length;
  }

  get todayCount(): number {
    const todayIso = format(this.today, 'yyyy-MM-dd');
    return this.tasks().filter(
      task => task.status === 'PENDING' && task.dueAt.startsWith(todayIso),
    ).length;
  }

  get upcomingCount(): number {
    const start = new Date(this.today.getFullYear(), this.today.getMonth(), this.today.getDate());
    const end = addDays(start, 7).getTime();
    return this.tasks().filter(task => {
      const due = new Date(task.dueAt).getTime();
      return task.status === 'PENDING' && due >= start.getTime() && due < end;
    }).length;
  }

  isOverdue(task: Task): boolean {
    return task.status === 'PENDING' && new Date(task.dueAt).getTime() < Date.now();
  }

  taskIcon(type: Task['type']): string {
    if (type === 'WATER_CHANGE') return 'water_drop';
    if (type === 'FERTILIZATION') return 'eco';
    if (type === 'TRIM') return 'content_cut';
    if (type === 'WATER_TEST') return 'science';
    return 'build';
  }

  taskTypeLabel(type: Task['type']): string {
    return this.taskTypes.find(item => item.value === type)?.label ?? 'Autre';
  }

  taskDueDate(task: Task): Date {
    return new Date(task.dueAt);
  }

  resetFilters(): void {
    this.aquariumFilter = 'ALL';
    this.typeFilter = 'ALL';
    this.statusFilter = 'ALL';
    this.dateFilter = 'ALL';
  }

  filterOverdue(): void {
    this.statusFilter = 'OVERDUE';
    this.dateFilter = 'ALL';
    this.viewMode = 'list';
  }

  filterToday(): void {
    this.resetFilters();
    this.dateFilter = 'TODAY';
    this.viewMode = 'list';
  }

  async toggleTask(task: Task, event: Event): Promise<void> {
    event.stopPropagation();
    if (this.changingTaskId !== null) return;
    this.changingTaskId = task.id;
    this.tasksApi
      .update(task.id, { status: task.status === 'DONE' ? 'PENDING' : 'DONE' })
      .subscribe({
        next: () => {
          this.changingTaskId = null;
          this.reloadMonth();
        },
        error: error => {
          console.error('Update task failed:', error);
          this.changingTaskId = null;
        },
      });
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
