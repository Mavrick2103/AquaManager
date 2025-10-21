import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';

import { Task } from '../../../core/tasks.service';

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
  ],
  templateUrl: './day-tasks-dialog.component.html',
  styleUrls: ['./day-tasks-dialog.component.scss'],
})
export class DayTasksDialogComponent {
  private ref = inject(MatDialogRef<DayTasksDialogComponent>);

  /** On reçoit la date et la liste des tâches depuis l’ouverture du dialog */
  constructor(
    @Inject(MAT_DIALOG_DATA)
    public data: { date: Date; tasks: Task[] }
  ) {}

  /** Liste triée par heure croissante */
  get tasks(): Task[] {
    return [...(this.data?.tasks ?? [])].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  }

  close() {
    this.ref.close(false);
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
