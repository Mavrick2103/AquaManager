import { Component, Inject, inject, OnInit } from '@angular/core';
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
  type: WaterType;
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
export class MeasurementDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private svc = inject(MeasurementsService);
  private snack = inject(MatSnackBar);

  loading = false;
  form!: FormGroup;

  constructor(
    private ref: MatDialogRef<MeasurementDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: MeasurementDialogData,
  ) {}

  ngOnInit() {
    this.form = this.fb.group({
      measuredAt: [new Date(), [Validators.required]],

      // communs
      ph:   [null, [Validators.min(0), Validators.max(14)]],
      temp: [null, [Validators.min(0), Validators.max(45)]],
      no2:  [null, [Validators.min(0), Validators.max(5)]],
      no3:  [null, [Validators.min(0), Validators.max(300)]],
      po4:  [null, [Validators.min(0), Validators.max(5)]],
      comment: [''],

      // eau douce
      kh:   [null, [Validators.min(0), Validators.max(30)]],
      gh:   [null, [Validators.min(0), Validators.max(40)]],
      fe:   [null, [Validators.min(0), Validators.max(3)]],
      k:    [null, [Validators.min(0), Validators.max(50)]],
      sio2: [null, [Validators.min(0), Validators.max(10)]],
      nh3:  [null, [Validators.min(0), Validators.max(5)]],

      // eau de mer
      dkh:      [null, [Validators.min(0), Validators.max(25)]],
      salinity: [null, [Validators.min(0), Validators.max(45)]],
      ca:       [null, [Validators.min(0), Validators.max(700)]],
      mg:       [null, [Validators.min(0), Validators.max(2000)]],
    });

    this.prefillFromLast();
  }

  private async prefillFromLast() {
    try {
      this.loading = true;
      const last = await this.svc.getLastForAquarium(this.data.aquariumId);
      if (!last) return;

      const patch: Record<string, any> = {
        // communs
        ph: last.ph ?? null,
        temp: last.temp ?? null,
        no2: last.no2 ?? null,
        no3: last.no3 ?? null,
        po4: last.po4 ?? null,
        comment: '',
      };

      if (this.data.type === 'EAU_DOUCE') {
        Object.assign(patch, {
          kh: last.kh ?? null,
          gh: last.gh ?? null,
          fe: last.fe ?? null,
          k: last.k ?? null,
          sio2: last.sio2 ?? null,
          nh3: last.nh3 ?? null,
          dkh: null, salinity: null, ca: null, mg: null,
        });
      } else {
        Object.assign(patch, {
          dkh: last.dkh ?? null,
          salinity: last.salinity ?? null,
          ca: last.ca ?? null,
          mg: last.mg ?? null,
          kh: null, gh: null, fe: null, k: null, sio2: null, nh3: null,
        });
      }

      this.form.patchValue(patch);
    } catch (e) {
    } finally {
      this.loading = false;
    }
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
        // communs
        ph:   v.ph ?? null,
        temp: v.temp ?? null,
        no2:  v.no2 ?? null,
        no3:  v.no3 ?? null,
        po4:  v.po4 ?? null,
        comment: v.comment?.toString().trim() || null,
        ...(this.data.type === 'EAU_DOUCE'
          ? {
              kh: v.kh ?? null,
              gh: v.gh ?? null,
              fe: v.fe ?? null,
              k: v.k ?? null,
              sio2: v.sio2 ?? null,
              nh3: v.nh3 ?? null,
              dkh: null, salinity: null, ca: null, mg: null,
            }
          : {
              dkh: v.dkh ?? null,
              salinity: v.salinity ?? null,
              ca: v.ca ?? null,
              mg: v.mg ?? null,
              kh: null, gh: null, fe: null, k: null, sio2: null, nh3: null,
            }),
      };

      await this.svc.createForAquarium(this.data.aquariumId, dto);
      this.svc.notifyChanged(this.data.aquariumId);

      this.ref.close(true);
      this.snack.open('Mesure enregistrée ✅', 'OK', { duration: 2000 });
    } catch (e: any) {
      this.snack.open(e?.error?.message || 'Échec de l’enregistrement', 'Fermer', { duration: 3500 });
    } finally {
      this.loading = false;
    }
  }
}
