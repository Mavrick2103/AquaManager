import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, Validators, FormBuilder } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

type DialogData = {
  title: string;
  message: string;
  initialDueAt?: string | null; // ISO
};

@Component({
  selector: 'app-reco-schedule-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>Planifier la tâche</h2>

    <div mat-dialog-content class="content">
      <div class="reco">
        <div class="reco-title">{{ data.title }}</div>
        <div class="reco-msg">{{ data.message }}</div>
      </div>

      <form [formGroup]="form" class="form">
        <mat-form-field appearance="outline">
          <mat-label>Date</mat-label>
          <input matInput type="date" formControlName="date" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Heure</mat-label>
          <input matInput type="time" formControlName="time" />
        </mat-form-field>

        <div class="hint">
          Conseil : choisis une heure où tu es dispo (ex: 19:00).
        </div>
      </form>
    </div>

    <div mat-dialog-actions align="end">
      <button mat-button (click)="close()">Annuler</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid" (click)="confirm()">
        <mat-icon>event</mat-icon>
        Ajouter au planning
      </button>
    </div>
  `,
  styles: [`
    .content { display: grid; gap: 14px; }
    .reco { padding: 10px 12px; border-radius: 12px; background: rgba(0,0,0,.03); }
    .reco-title { font-weight: 700; margin-bottom: 6px; }
    .reco-msg { opacity: .85; }
    .form { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .hint { grid-column: 1 / -1; font-size: 12px; opacity: .7; }
  `],
})
export class RecommendationScheduleDialogComponent {
  // ✅ IMPORTANT : fb doit être initialisé AVANT form
  private readonly fb = inject(FormBuilder);
  private readonly ref = inject(MatDialogRef<RecommendationScheduleDialogComponent>);

  // ✅ Non-nullable => plus de "possibly null"
  readonly form = this.fb.nonNullable.group({
    date: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    time: this.fb.nonNullable.control('19:00', { validators: [Validators.required] }),
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: DialogData) {
    // Préremplissage si la reco a déjà un dueAt
    const iso = data.initialDueAt ? new Date(data.initialDueAt) : null;

    if (iso && !Number.isNaN(iso.getTime())) {
      const yyyy = iso.getFullYear();
      const mm = String(iso.getMonth() + 1).padStart(2, '0');
      const dd = String(iso.getDate()).padStart(2, '0');
      const hh = String(iso.getHours()).padStart(2, '0');
      const mi = String(iso.getMinutes()).padStart(2, '0');

      this.form.patchValue({ date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}` });
    } else {
      // ✅ valeur par défaut : aujourd’hui
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      this.form.patchValue({ date: `${yyyy}-${mm}-${dd}` });
    }
  }

  close() {
    this.ref.close(null);
  }

  confirm() {
    const { date, time } = this.form.getRawValue();

    if (!date || !time) return;

    const [y, m, d] = date.split('-').map(Number);
    const [hh, mi] = time.split(':').map(Number);

    if (![y, m, d, hh, mi].every((n) => Number.isFinite(n))) return;

    // ✅ date locale -> ISO (stockage backend)
    const dt = new Date(y, m - 1, d, hh, mi, 0, 0);
    this.ref.close({ dueAt: dt.toISOString() });
  }
}