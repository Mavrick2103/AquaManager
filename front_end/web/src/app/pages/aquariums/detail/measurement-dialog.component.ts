import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

@Component({
  selector: 'app-measurement-dialog',
  standalone: true,
  imports: [
    CommonModule, MatDialogModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatDatepickerModule, MatNativeDateModule
  ],
  template: `
    <h2 mat-dialog-title>Nouvelle mesure</h2>
    <div mat-dialog-content [formGroup]="form" class="grid">
      <mat-form-field appearance="outline">
        <mat-label>Date</mat-label>
        <input matInput [matDatepicker]="dp" formControlName="date">
        <mat-datepicker-toggle matIconSuffix [for]="dp"></mat-datepicker-toggle>
        <mat-datepicker #dp></mat-datepicker>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Heure</mat-label>
        <input matInput type="time" formControlName="time">
      </mat-form-field>

      <ng-container *ngFor="let f of fields">
        <mat-form-field appearance="outline">
          <mat-label>{{ f.label }}</mat-label>
          <input matInput type="number" step="0.01" [formControlName]="f.key">
        </mat-form-field>
      </ng-container>
    </div>

    <div mat-dialog-actions style="display:flex;gap:10px;justify-content:flex-end;">
      <button mat-stroked-button (click)="ref.close()">Annuler</button>
      <button mat-flat-button color="primary" (click)="save()">Enregistrer</button>
    </div>
  `,
  styles: [`
    .grid{ display:grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap:12px; }
    @media (max-width: 760px){ .grid{ grid-template-columns: 1fr; } }
    button[color="primary"]{ background:linear-gradient(135deg,#009FE3,#39B54A); color:#fff; font-weight:700; }
  `]
})
export class MeasurementDialogComponent {
  ref = inject(MatDialogRef<MeasurementDialogComponent>);
  data = inject(MAT_DIALOG_DATA) as { };

  private fb = inject(NonNullableFormBuilder);

  fields = [
    { key: 'ph', label: 'pH' }, { key: 'kh', label: 'KH' }, { key: 'gh', label: 'GH' },
    { key: 'co2', label: 'CO₂ (mg/L)' }, { key: 'k', label: 'Potassium K (mg/L)' },
    { key: 'no2', label: 'NO₂ (mg/L)' }, { key: 'no3', label: 'NO₃ (mg/L)' },
    { key: 'amn', label: 'Ammoniaque (mg/L)' }, { key: 'fe', label: 'Fer Fe (mg/L)' },
    { key: 'temp', label: 'Température (°C)' }, { key: 'po4', label: 'Phosphates PO₄ (mg/L)' },
  ] as const;

  form = this.fb.group({
    date: [new Date(), Validators.required],
    time: ['12:00', Validators.required],
    ph: [null as number | null],
    kh: [null as number | null],
    gh: [null as number | null],
    co2: [null as number | null],
    k: [null as number | null],
    no2: [null as number | null],
    no3: [null as number | null],
    amn: [null as number | null],
    fe: [null as number | null],
    temp: [null as number | null],
    po4: [null as number | null],
  });

  private toIsoLocal(d: Date, time: string): string {
    const [hh, mm] = time.split(':').map(Number);
    const dt = new Date(d);
    dt.setHours(hh ?? 0, mm ?? 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:00`;
  }

  save() {
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    const takenAt = this.toIsoLocal(raw.date, raw.time);
    const payload: any = { takenAt };

    // ne garde que les champs renseignés
    for (const k of Object.keys(raw) as (keyof typeof raw)[]) {
      if (['date','time'].includes(k as any)) continue;
      const v = raw[k];
      if (v !== null && v !== undefined && v !== '') (payload as any)[k] = Number(v);
    }
    this.ref.close(payload);
  }
}
