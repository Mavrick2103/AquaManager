import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';

import { TasksService, Task } from '../../../../core/tasks.service';
import { AquariumsService, Aquarium } from '../../../../core/aquariums.service';

type TaskType = 'WATER_CHANGE' | 'FERTILIZATION' | 'TRIM' | 'WATER_TEST' | 'OTHER';

@Component({
  selector: 'app-task-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './task-detail-dialog.component.html',
  styleUrls: ['./task-detail-dialog.component.scss']
})
export class TaskDetailDialogComponent implements OnInit {
  private ref = inject(MatDialogRef<TaskDetailDialogComponent>);
  private tasksApi = inject(TasksService);
  private aquariumsApi = inject(AquariumsService);

  /** Modèle éditable lié au formulaire */
  editing: {
    id: number;
    title: string;
    description?: string | null;
    dueAt: string; // format pour <input type="datetime-local"> => "YYYY-MM-DDTHH:mm"
    type: TaskType;
    aquarium?: { id: number; name?: string };
  };

  /** Liste des bacs pour le select + sélection courante */
  aquariums: Aquarium[] = [];
  selectedAquariumId: number | null = null;

  constructor(@Inject(MAT_DIALOG_DATA) public data: { task: Task }) {
    const t = data.task;
    this.editing = {
      id: t.id,
      title: t.title,
      description: t.description ?? '',
      dueAt: this.toLocalInputValue(t.dueAt),
      type: t.type,
      aquarium: t.aquarium
    };
    this.selectedAquariumId = t.aquarium?.id ?? null;
  }

  ngOnInit(): void {
    // listMine() renvoie un Observable => on s’abonne
    this.aquariumsApi.listMine().subscribe({
      next: (list) => {
        this.aquariums = list || [];
        if (!this.selectedAquariumId && this.aquariums.length) {
          this.selectedAquariumId = this.aquariums[0].id;
        }
      },
      error: () => {
        this.aquariums = [];
      }
    });
  }

  /** ISO -> "YYYY-MM-DDTHH:mm" pour l’input datetime-local */
  private toLocalInputValue(iso: string): string {
    if (iso && iso.length === 16 && iso.includes('T')) return iso;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  /** "YYYY-MM-DDTHH:mm" (local) -> ISO UTC (conforme @IsDateString) */
  private toIsoUtc(inputLocal: string): string {
    const d = new Date(inputLocal);
    return d.toISOString();
  }

  save() {
    const payload: Partial<{
      title: string;
      description?: string;
      dueAt: string;
      aquariumId: number;
      type: TaskType;
    }> = {
      title: (this.editing.title || '').trim(),
      description: (this.editing.description ?? '').toString(),
      dueAt: this.editing.dueAt ? this.toIsoUtc(this.editing.dueAt) : undefined,
      type: this.editing.type,
      aquariumId: this.selectedAquariumId ?? undefined,
    };

    this.tasksApi.update(this.editing.id, payload).subscribe({
      next: (res) => this.ref.close(res),   // renvoie la tâche mise à jour au parent
      error: (err: unknown) => {
        console.error(err);
        alert('Erreur lors de la mise à jour. Vérifie la date/heure et l’aquarium.');
      }
    });
  }

  delete() {
    const ok = confirm(`Supprimer la tâche « ${this.editing.title} » ?`);
    if (!ok) return;

    // ✅ Utilise delete(...) car ton service n’a pas remove(...)
    this.tasksApi.delete(this.editing.id).subscribe({
      next: () => this.ref.close({ deleted: true }),
      error: (err: unknown) => {
        console.error(err);
        alert('Erreur lors de la suppression');
      }
    });
  }

  cancel() {
    this.ref.close();
  }
}
