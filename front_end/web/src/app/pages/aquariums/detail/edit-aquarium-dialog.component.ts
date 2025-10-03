import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

export type WaterType = 'EAU_DOUCE' | 'EAU_DE_MER';

export interface EditAquariumData {
  initial: {
    name: string;
    waterType: WaterType;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    startDate?: string; // YYYY-MM-DD
  };
}

@Component({
  selector: 'app-edit-aquarium-dialog',
  standalone: true,
  templateUrl: './edit-aquarium-dialog.component.html',
  styleUrls: ['./edit-aquarium-dialog.component.scss'],
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule
  ],
})
export class EditAquariumDialogComponent {
  private fb = inject(FormBuilder);
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: EditAquariumData,
    private ref: MatDialogRef<EditAquariumDialogComponent>
  ) {}

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    waterType: ['EAU_DOUCE' as WaterType, Validators.required],
    lengthCm: [0, [Validators.required, Validators.min(1)]],
    widthCm:  [0, [Validators.required, Validators.min(1)]],
    heightCm: [0, [Validators.required, Validators.min(1)]],
    startDate: [''], // string vide si non renseigné
  });

  ngOnInit() {
    const i = this.data?.initial;
    if (i) {
      this.form.patchValue({
        name: i.name ?? '',
        waterType: i.waterType ?? 'EAU_DOUCE',
        lengthCm: i.lengthCm ?? 0,
        widthCm: i.widthCm ?? 0,
        heightCm: i.heightCm ?? 0,
        startDate: i.startDate ?? '',
      });
    }
  }

  cancel() { this.ref.close(); }
  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.ref.close(this.form.getRawValue()); // on renvoie les valeurs au parent
  }
}
