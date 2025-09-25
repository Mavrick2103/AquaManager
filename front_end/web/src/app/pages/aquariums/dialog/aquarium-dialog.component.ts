import { Component, Inject, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AquariumsService, CreateAquariumDto, WaterType } from '../../../core/aquariums.service';

@Component({
  selector: 'app-aquarium-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatDatepickerModule, MatNativeDateModule,
    MatButtonModule, MatIconModule,
  ],
  templateUrl: './aquarium-dialog.component.html',
  styleUrls: ['./aquarium-dialog.component.scss'],
})
export class AquariumDialogComponent {
  private fb = inject(FormBuilder);
  private api = inject(AquariumsService);
  private ref = inject(MatDialogRef<AquariumDialogComponent>);
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {}

  submitting = signal(false);

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    lengthCm: [60, [Validators.required, Validators.min(10), Validators.max(500)]],
    widthCm:  [30, [Validators.required, Validators.min(10), Validators.max(200)]],
    heightCm: [35, [Validators.required, Validators.min(10), Validators.max(200)]],
    waterType: ['EAU_DOUCE' as WaterType, [Validators.required]],
    startDate: [new Date(), [Validators.required]],
  });

  // Recalcul live
  liters = computed(() => {
    const v = this.form.value;
    const L = Number(v.lengthCm) || 0;
    const W = Number(v.widthCm) || 0;
    const H = Number(v.heightCm) || 0;
    return Math.round((L * W * H) / 1000); // cm³ -> L
  });

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);

    const v = this.form.value;
    const dto: CreateAquariumDto = {
      name: v.name!.trim(),
      lengthCm: Number(v.lengthCm),
      widthCm: Number(v.widthCm),
      heightCm: Number(v.heightCm),
      waterType: v.waterType as WaterType,
      startDate: new Date(v.startDate as Date).toISOString().slice(0, 10), // yyyy-mm-dd
    };

    this.api.create(dto).subscribe({
      next: () => { this.submitting.set(false); this.ref.close(true); }, // ✅ indique succès
      error: () => { this.submitting.set(false); /* affiche une erreur si tu veux */ },
    });
  }

  close() { this.ref.close(false); }
}
