import { Component, Inject, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { formatISO } from 'date-fns';

import { TasksService } from '../../../core/tasks.service';
import { AquariumsService } from '../../../core/aquariums.service';

@Component({
  selector: 'app-task-dialog',
  standalone: true,
  imports: [
    CommonModule, MatDialogModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatDatepickerModule, MatNativeDateModule
  ],
  templateUrl: './task-dialog.component.html',
  styleUrls: ['./task-dialog.component.scss'],
})
export class TaskDialogComponent {
  private fb = inject(FormBuilder);
  private tasksApi = inject(TasksService);
  private aquasApi = inject(AquariumsService);
  private ref = inject(MatDialogRef<TaskDialogComponent>);

  // ✅ tableau des types utilisé par le template
  types = [
    { value: 'WATER_CHANGE', label: 'Changement d’eau' },
    { value: 'FERTILIZATION', label: 'Fertilisation' },
    { value: 'TRIM', label: 'Taille des plantes' },
    { value: 'WATER_TEST', label: 'Test de l’eau' },
    { value: 'OTHER', label: 'Autre' },
  ];

  aquariums = signal<{ id: number; name: string }[]>([]);
  form!: FormGroup;

  constructor(@Inject(MAT_DIALOG_DATA) public data: { date: Date }) {
    // form construit après injection (évite "data used before init")
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(200)]],
      description: [''],
      date: [data?.date ?? new Date(), Validators.required],
      time: ['10:00', Validators.required],
      aquariumId: [null as unknown as number, Validators.required],
      type: ['OTHER', Validators.required],
    });

    // ⚠️ ton back renvoie tes aquariums sur GET /aquariums
    this.aquasApi.listMine().subscribe((aq) => {
      this.aquariums.set(aq.map((x: any) => ({ id: x.id, name: x.name })));
      if (aq.length === 1) this.form.patchValue({ aquariumId: aq[0].id });
    });
  }

  save() {
    if (this.form.invalid) return;
    const { title, description, date, time, aquariumId, type } = this.form.value;

    const [h, m] = (time as string).split(':').map(Number);
    const d = new Date(date as Date);
    d.setHours(h, m, 0, 0);

    this.tasksApi.create({
      title: (title as string).trim(),
      description: ((description as string) || '').trim(),
      dueAt: formatISO(d),
      aquariumId: Number(aquariumId),
      type: type as any,
    }).subscribe({
      next: () => this.ref.close(true),
      error: () => this.form.disable(),
    });
  }
}
