import { Component, Inject, inject, signal } from '@angular/core';
import { format } from 'date-fns';
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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AquariumsService, CreateAquariumDto, WaterType } from '../../../core/aquariums.service';

@Component({
  selector: 'app-aquarium-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatDatepickerModule, MatNativeDateModule,
    MatButtonModule, MatIconModule, MatCheckboxModule, MatRadioModule, MatSnackBarModule,
  ],
  templateUrl: './aquarium-dialog.component.html',
  styleUrls: ['./aquarium-dialog.component.scss'],
})
export class AquariumDialogComponent {
  private fb = inject(FormBuilder);
  private api = inject(AquariumsService);
  private ref = inject(MatDialogRef<AquariumDialogComponent>);
  private snack = inject(MatSnackBar);

  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {
    if (data?.tutorial) this.form.patchValue({ name: 'Mon bac de découverte', setupCycling: false });
    // calcul initial du litrage
    this.updateLiters();
    // recalcule à chaque modification du formulaire
    this.form.valueChanges.subscribe(() => this.updateLiters());
  }

  submitting = signal(false);
  liters = signal(0);

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    lengthCm: [60, [Validators.required, Validators.min(10), Validators.max(500)]],
    widthCm:  [30, [Validators.required, Validators.min(10), Validators.max(200)]],
    heightCm: [35, [Validators.required, Validators.min(10), Validators.max(200)]],
    waterType: ['EAU_DOUCE' as WaterType, [Validators.required]],
    startDate: [new Date(), [Validators.required]],
    aquariumStage: ['existing'],
    setupCycling: [false],
  });

  onStageChange(): void {
    this.form.controls.setupCycling.setValue(this.form.controls.aquariumStage.value === 'new');
  }

  private updateLiters(): void {
    const v = this.form.value;
    const L = Number(v.lengthCm) || 0;
    const W = Number(v.widthCm) || 0;
    const H = Number(v.heightCm) || 0;

    if (!L || !W || !H) {
      this.liters.set(0);
      return;
    }

    this.liters.set(Math.round((L * W * H) / 1000));
  }

  submit() {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);

    const v = this.form.value;
    const dto: CreateAquariumDto = {
      name: v.name!.trim(),
      lengthCm: Number(v.lengthCm),
      widthCm: Number(v.widthCm),
      heightCm: Number(v.heightCm),
      waterType: v.waterType as WaterType,
      startDate: format(v.startDate as Date, 'yyyy-MM-dd'),
    };

    if (this.data?.tutorial === true) {
      this.submitting.set(false);
      this.ref.close({
        aquarium: { id: -1, ...dto },
        setupCycling: v.aquariumStage === 'new' && v.setupCycling === true,
        tutorial: true,
      });
      return;
    }

    this.api.create(dto).subscribe({
      next: (aquarium) => {
        this.submitting.set(false);
        this.ref.close({
          aquarium,
          setupCycling: v.aquariumStage === 'new' && v.setupCycling === true,
        });
      },
      error: (error) => {
        this.submitting.set(false);
        this.snack.open(
          error?.error?.message ?? 'Impossible de créer cet aquarium.',
          'Fermer',
          { duration: 5000 },
        );
      },
    });
  }

  fieldError(name: string): string {
    const errors = this.form.get(name)?.errors;
    if (errors?.['matDatepickerParse']) return 'Indique une date valide.';
    if (errors?.['required']) return 'Ce champ est requis.';
    if (errors?.['min']) return `Minimum : ${errors['min'].min} cm.`;
    if (errors?.['max']) return `Maximum : ${errors['max'].max} cm.`;
    if (errors?.['maxlength']) return 'Maximum 80 caractères.';
    return 'Vérifie la valeur saisie.';
  }

  close() {
    this.ref.close(false);
  }
}
