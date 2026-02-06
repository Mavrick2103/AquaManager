import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Task, TasksService, CreateTaskPayload } from '../../../core/tasks.service';
import { TaskDetailDialogComponent } from '../day-tasks-dialog/task-detail-dialog/task-detail-dialog.component';
import { TaskDialogComponent } from '../task-dialog/task-dialog.component'; // ⬅️ adapte si besoin

type TaskType = 'WATER_CHANGE' | 'FERTILIZATION' | 'TRIM' | 'WATER_TEST' | 'OTHER';

@Component({
  selector: 'app-day-tasks-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatIconModule,
    MatButtonModule,
    MatListModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  templateUrl: './day-tasks-dialog.component.html',
  styleUrls: ['./day-tasks-dialog.component.scss'],
})
export class DayTasksDialogComponent {
  private ref = inject(MatDialogRef<DayTasksDialogComponent>);
  private dialog = inject(MatDialog);
  private tasksApi = inject(TasksService);

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public data: { date: Date; tasks: Task[] }
  ) {}

  get tasks(): Task[] {
    return [...(this.data?.tasks ?? [])].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  }

  close(changed = false) {
    this.ref.close(changed);
  }

  // ✅ NOUVEAU: bouton +
  addTask() {
    this.dialog
      .open(TaskDialogComponent, {
        data: { date: this.data.date },
        width: '92vw',
        maxWidth: '900px',
        minWidth: '320px',
        maxHeight: '92vh',
        autoFocus: false,
        restoreFocus: false,
      })
      .afterClosed()
      .subscribe((payload: CreateTaskPayload | null | undefined) => {
        if (!payload) return;

        // ✅ création API
        this.tasksApi.create(payload).subscribe({
          next: (created) => {
            this.data.tasks.push(created);
            this.close(true);
          },
          error: (err) => {
            console.error(err);
            alert('Erreur lors de la création de la tâche.');
          },
        });
      });
  }

  openDetails(t: Task) {
    this.dialog
      .open(TaskDetailDialogComponent, {
        data: { task: t },
        width: '92vw',
        maxWidth: '900px',
        minWidth: '320px',
        maxHeight: '92vh',
        autoFocus: false,
        restoreFocus: false,
        panelClass: ['task-detail-dialog-panel'],
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;

        if (result.deleted) {
          this.removeLocal(t.id);
          this.close(true);
          return;
        }

        if (result && result.id) {
          this.replaceLocal(result as Task);
          this.close(true);
        }
      });
  }

  private replaceLocal(updated: Task) {
    const idx = this.data.tasks.findIndex((x) => x.id === updated.id);
    if (idx >= 0) this.data.tasks.splice(idx, 1, updated);
  }

  private removeLocal(id: number) {
    const idx = this.data.tasks.findIndex((x) => x.id === id);
    if (idx >= 0) this.data.tasks.splice(idx, 1);
  }

  typeIcon(type?: string): string {
    switch (type as TaskType) {
      case 'WATER_CHANGE':  return 'opacity';
      case 'FERTILIZATION': return 'eco';
      case 'TRIM':          return 'content_cut';
      case 'WATER_TEST':    return 'science';
      default:              return 'task_alt';
    }
  }

  typeLabel(type?: string): string {
    switch (type as TaskType) {
      case 'WATER_CHANGE':  return 'Changement d’eau';
      case 'FERTILIZATION': return 'Fertilisation';
      case 'TRIM':          return 'Taille/entretien';
      case 'WATER_TEST':    return 'Test de l’eau';
      default:              return 'Tâche';
    }
  }

  cssClass(type?: string): string {
    switch ((type || '').toLowerCase()) {
      case 'water_change': return 'water_change';
      case 'fertilization': return 'fertilization';
      case 'trim': return 'trim';
      case 'water_test': return 'water_test';
      default: return 'other';
    }
  }
}
