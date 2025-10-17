import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MeasurementsService, MeasurementCreateDto } from '../../../core/water.service';

export type WaterType = 'EAU_DOUCE' | 'EAU_DE_MER';

export interface MeasurementDialogData {
  aquariumId: number;
  type: WaterType;   // déjà connu → on ne redemande pas
  name?: string;
}

@Component({
  selector: 'app-measurement-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule,
    MatButtonModule, MatFormFieldModule, MatInputModule,
    MatDatepickerModule, MatNativeDateModule, MatIconModule,
    MatSnackBarModule, MatProgressSpinnerModule,
  ],
  templateUrl: './measurement-dialog.component.html',
  styleUrls: ['./measurement-dialog.component.scss'],
})
export class MeasurementDialogComponent {
  private fb = inject(FormBuilder);
  private svc = inject(MeasurementsService);
  private snack = inject(MatSnackBar);

  loading = false;
  form: FormGroup;

  constructor(
    private ref: MatDialogRef<MeasurementDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: MeasurementDialogData,
  ) {
    const base = {
      measuredAt: [new Date(), [Validators.required]],
      ph:   [7.0, [Validators.min(0), Validators.max(14)]],
      temp: [25,  [Validators.min(0), Validators.max(40)]],
      po4:  [0.05, [Validators.min(0), Validators.max(5)]],
      no2:  [0,   [Validators.min(0), Validators.max(5)]],
      no3:  [10,  [Validators.min(0), Validators.max(300)]],
      kh:   [5,   [Validators.min(0), Validators.max(30)]],




      comment: [''],
    };

    const eauDouce = {
      gh:  [8,   [Validators.min(0), Validators.max(40)]],
      fe:   [0.00, [Validators.min(0), Validators.max(3)]],   // mg/L
      k:    [0,    [Validators.min(0), Validators.max(50)]],  // mg/L
      sio2: [0,    [Validators.min(0), Validators.max(10)]],  // mg/L
      nh3:  [0.00, [Validators.min(0), Validators.max(5)]],   // mg/L
    };

    const eauDeMer = {
      dkh:      [8,    [Validators.min(0), Validators.max(20)]],
      salinity: [35,   [Validators.min(0), Validators.max(45)]], // ppt
      ca:       [420,  [Validators.min(0), Validators.max(600)]],
      mg:       [1300, [Validators.min(0), Validators.max(1800)]],
    };

    this.form = this.fb.group({
      ...base,
      ...(this.data.type === 'EAU_DOUCE' ? eauDouce : eauDeMer),
    });
  }

  close() { this.ref.close(false); }

  async save() {
    if (this.form.invalid) return;
    this.loading = true;
    try {
      const v = this.form.value;
      const measuredAtIso =
        v.measuredAt instanceof Date ? v.measuredAt.toISOString() : new Date(v.measuredAt).toISOString();

      const dto: MeasurementCreateDto = {
        measuredAt: measuredAtIso,
        ph:   v.ph ?? null,
        temp: v.temp ?? null,
        comment: v.comment?.toString().trim() || null,

        ...(this.data.type === 'EAU_DOUCE'
          ? {
              kh: v.kh ?? null,
              gh: v.gh ?? null,
              no2: v.no2 ?? null,
              no3: v.no3 ?? null,
              fe:   v.fe   ?? null,
              k:    v.k    ?? null,
              sio2: v.sio2 ?? null,
              nh3:  v.nh3  ?? null,         
              po4: v.po4 ?? null,

            }
          : {
              dkh: v.dkh ?? null,
              salinity: v.salinity ?? null,
              ca: v.ca ?? null,
              mg: v.mg ?? null,
            }),
      };

      await this.svc.createForAquarium(this.data.aquariumId, dto);
      this.ref.close(true);
    } catch (e: any) {
      this.snack.open(e?.error?.message || 'Échec de l’enregistrement', 'Fermer', { duration: 3500 });
    } finally {
      this.loading = false;
    }
  }
}
