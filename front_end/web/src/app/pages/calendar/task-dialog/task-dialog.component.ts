import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';

import { AquariumsService, Aquarium } from '../../../core/aquariums.service';
import { TasksService } from '../../../core/tasks.service';

type TaskType = 'WATER_CHANGE' | 'FERTILIZATION' | 'TRIM' | 'WATER_TEST' | 'OTHER';

@Component({
  selector: 'app-task-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatChipsModule,
  ],
  templateUrl: './task-dialog.component.html',
  styleUrls: ['./task-dialog.component.scss'],
})
export class TaskDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<TaskDialogComponent>);
  private aquariumsApi = inject(AquariumsService);
  private tasksApi = inject(TasksService);

  constructor(@Inject(MAT_DIALOG_DATA) public data: { date?: Date } | null) {}

  types: Array<{ value: TaskType; label: string }> = [
    { value: 'WATER_CHANGE', label: 'Changement d’eau' },
    { value: 'FERTILIZATION', label: 'Fertilisation' },
    { value: 'TRIM',         label: 'Taille / entretien' },
    { value: 'WATER_TEST',   label: 'Test de l’eau' },
    { value: 'OTHER',        label: 'Autre' },
  ];

  private aquariumsList: Aquarium[] = [];
  aquariums() { return this.aquariumsList; }

  loadingAquariums = true;

  form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    date: [new Date(), Validators.required],
    time: ['09:00'],
    aquariumId: [null as number | null, Validators.required],
    type: ['OTHER' as TaskType, Validators.required],
  });

  ngOnInit(): void {
    if (this.data?.date instanceof Date) {
      this.form.patchValue({ date: this.data.date });
    }

    this.aquariumsApi.listMine().subscribe({
      next: (list) => {
        this.aquariumsList = list || [];
        this.loadingAquariums = false;

        if (!this.aquariumsList.length) return;

        if (!this.form.value.aquariumId) {
          this.form.patchValue({ aquariumId: this.aquariumsList[0].id });
        }
      },
      error: () => {
        this.aquariumsList = [];
        this.loadingAquariums = false;
      }
    });
  }

  private buildIsoDueAt(date: Date | null, time: string | null): string {
    const d = date ?? new Date();
    const hhmm = (time && /^\d{2}:\d{2}$/.test(time)) ? time : '09:00';
    const [h, m] = hhmm.split(':').map(n => +n);
    const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
    return local.toISOString();
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    if (!this.aquariumsList.length) {
      alert('Crée d’abord un aquarium pour associer la tâche.');
      return;
    }

    const v = this.form.getRawValue();
    const dueAtIso = this.buildIsoDueAt(v.date as Date, v.time || '09:00');

    this.tasksApi.create({
      title: (v.title || '').trim(),
      description: (v.description || '') || undefined,
      dueAt: dueAtIso,
      aquariumId: v.aquariumId as number,
      type: v.type as TaskType,
    }).subscribe({
      next: (created) => this.dialogRef.close(created),
      error: (err: unknown) => {
        console.error(err);
        alert('Erreur lors de la création de la tâche. Vérifie la date/heure et l’aquarium.');
      }
    });
  }
}
