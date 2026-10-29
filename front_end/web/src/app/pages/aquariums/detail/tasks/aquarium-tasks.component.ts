import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, OnChanges, inject } from '@angular/core';
import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

import { Task, TasksService } from '../../../../core/tasks.service';
import { TaskDetailDialogComponent } from '../../../calendar/day-tasks-dialog/task-detail-dialog/task-detail-dialog.component';

@Component({
  selector: 'app-aquarium-tasks',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './aquarium-tasks.component.html',
  styleUrl: './aquarium-tasks.component.scss',
})
export class AquariumTasksComponent implements OnChanges {
  @Input({ required: true }) aquariumId!: number;
  @Input() aquariumName = '';
  @Output() tasksChanged = new EventEmitter<void>();

  private readonly tasksApi = inject(TasksService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly router = inject(Router);

  tasks: Task[] = [];
  loading = false;
  loadError = false;
  hasLoaded = false;
  changingId: string | number | null = null;
  month = startOfMonth(new Date());
  private request = 0;
  get monthLabel(): string { return format(this.month,'MMMM yyyy',{locale:fr}); }
  changeMonth(delta: number): void { this.month=addMonths(this.month,delta); void this.load(); }
  currentMonth(): void { this.month=startOfMonth(new Date()); void this.load(); }

  ngOnChanges(): void {
    if (Number.isFinite(this.aquariumId)) void this.load();
  }

  get pendingTasks(): Task[] {
    return this.tasks
      .filter(task => task.status === 'PENDING')
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }

  get completedTasks(): Task[] {
    return this.tasks
      .filter(task => task.status === 'DONE')
      .sort((a, b) => new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime());
  }

  get overdueCount(): number {
    return this.pendingTasks.filter(task => this.isOverdue(task)).length;
  }

  async load(): Promise<void> {
    const request=++this.request;
    const aquariumId=this.aquariumId;
    const from=startOfMonth(this.month),to=endOfMonth(this.month);
    this.loading = true;
    this.loadError = false;
    try {
      const tasks = await this.tasksApi.listWindow(from,to);
      if(request!==this.request) return;
      this.tasks = tasks.filter(
        task => Number(task.aquarium?.id) === Number(aquariumId) && new Date(task.dueAt)>=from && new Date(task.dueAt)<=to,
      );
      this.hasLoaded = true;
    } catch {
      if(request===this.request) this.loadError = true;
    } finally {
      if(request===this.request) this.loading = false;
    }
  }

  isOverdue(task: Task): boolean {
    return task.status === 'PENDING' && new Date(task.dueAt).getTime() < Date.now();
  }

  icon(type: Task['type']): string {
    if (type === 'WATER_CHANGE') return 'water_drop';
    if (type === 'FERTILIZATION') return 'eco';
    if (type === 'TRIM') return 'content_cut';
    if (type === 'WATER_TEST') return 'science';
    return 'build';
  }

  typeLabel(type: Task['type']): string {
    const labels: Record<Task['type'], string> = {
      WATER_CHANGE: 'Changement d’eau',
      FERTILIZATION: 'Fertilisation',
      TRIM: 'Taille et entretien',
      WATER_TEST: 'Test de l’eau',
      OTHER: 'Autre tâche',
    };
    return labels[type];
  }

  repeatLabel(task: Task): string | null {
    const mode = task.repeat?.mode;
    if (!mode || mode === 'NONE') return null;
    if (mode === 'DAILY') return 'Tous les jours';
    if (mode === 'EVERY_2_DAYS') return 'Tous les 2 jours';
    if (mode === 'WEEKLY') return 'Chaque semaine';
    return `Toutes les ${task.repeat?.everyWeeks ?? 2} semaines`;
  }

  async toggleStatus(task: Task): Promise<void> {
    if(this.changingId!==null || this.loading || this.loadError) return;
    this.changingId=task.id;
    try {
      await firstValueFrom(
        this.tasksApi.update(task.id, {
          status: task.status === 'DONE' ? 'PENDING' : 'DONE',
        }),
      );
      await this.load();
      this.tasksChanged.emit();
      this.snack.open(task.status === 'DONE' ? 'Tâche remise à faire' : 'Tâche terminée', 'OK', {
        duration: 2200,
      });
    } catch (error) {
      console.error(error);
      this.snack.open('Impossible de modifier la tâche', 'Fermer', { duration: 3000 });
    } finally {
      this.changingId=null;
    }
  }

  openDetails(task: Task): void {
    this.dialog
      .open(TaskDetailDialogComponent, {
        data: { task },
        autoFocus: false,
        restoreFocus: false,
        width: 'min(900px, 96vw)',
        maxHeight: '90vh',
      })
      .afterClosed()
      .subscribe(result => {
        if (result) { void this.load(); this.tasksChanged.emit(); }
      });
  }

  openCalendar(): void {
    this.router.navigate(['/calendar'],{queryParams:{aquariumId:this.aquariumId,aquariumName:this.aquariumName || undefined,month:format(this.month,'yyyy-MM')}});
  }
}
