import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatListModule } from '@angular/material/list';

import { AquariumsService, Aquarium } from '../../../core/aquariums.service';
import { WaterMeasurementsChartComponent } from './chart/chart.component';
import { MeasurementDialogComponent } from './measurement-dialog.component';
import { EditAquariumDialogComponent } from './edit-aquarium-dialog.component';

type WaterType = 'EAU_DOUCE' | 'EAU_DE_MER';

@Component({
  selector: 'app-aquarium-detail',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatSnackBarModule, MatDividerModule,
    MatProgressSpinnerModule, MatChipsModule, MatDialogModule,
    MatTabsModule, MatListModule,
    WaterMeasurementsChartComponent,
  ],
  templateUrl: './aquarium-detail.component.html',
  styleUrls: ['./aquarium-detail.component.scss'],
})
export class AquariumDetailComponent implements OnInit {
  private route  = inject(ActivatedRoute);
  private api    = inject(AquariumsService);
  private fb     = inject(FormBuilder);
  private snack  = inject(MatSnackBar);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  id!: number;
  loading = true;
  saving  = false;

  // Form utilisé pour afficher/resynchroniser les infos (dialog -> page)
  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    lengthCm: [0, [Validators.required, Validators.min(1)]],
    widthCm:  [0, [Validators.required, Validators.min(1)]],
    heightCm: [0, [Validators.required, Validators.min(1)]],
    waterType: ['EAU_DOUCE' as WaterType, Validators.required],
    startDate: ['']
  });

  // ------- Onglet "Espèces" (local front seulement pour l'instant)
  species: { name: string; count: number }[] = [];

  async ngOnInit() {
    this.id = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.id) {
      this.snack.open('ID aquarium invalide', 'Fermer', { duration: 3000 });
      this.router.navigate(['/aquariums']);
      return;
    }
    await this.load();
  }

  async load() {
    this.loading = true;
    try {
      const a = await firstValueFrom(this.api.getById(this.id));
      if (a) this.form.patchValue(a as any);
      // TODO: quand tu auras l’API espèces, charge-les ici
    } catch {
      this.snack.open('Impossible de charger cet aquarium', 'Fermer', { duration: 3000 });
      this.router.navigate(['/aquariums']);
    } finally {
      this.loading = false;
    }
  }

  get liters(): number {
    const v = this.form.value;
    const L = Number(v.lengthCm) || 0;
    const W = Number(v.widthCm) || 0;
    const H = Number(v.heightCm) || 0;
    return Math.round((L * W * H) / 1000);
  }

  // utilisé par le chart
  get waterType(): WaterType {
    return (this.form?.value?.waterType ?? 'EAU_DOUCE') as WaterType;
  }

  async save() {
    if (this.form.invalid) return;
    this.saving = true;
    try {
      const dto = this.form.getRawValue() as Partial<Aquarium>;
      await firstValueFrom(this.api.update(this.id, dto));
      this.form.markAsPristine();
      this.snack.open('Modifications enregistrées', 'OK', { duration: 2000 });
    } catch {
      this.snack.open('Échec de la sauvegarde', 'Fermer', { duration: 3000 });
    } finally {
      this.saving = false;
    }
  }

  async remove() {
    if (!confirm('Supprimer définitivement cet aquarium ?')) return;
    this.saving = true;
    try {
      await firstValueFrom(this.api.remove(this.id));
      this.snack.open('Aquarium supprimé', 'OK', { duration: 2000 });
      this.router.navigate(['/aquariums']);
    } catch {
      this.snack.open('Échec de la suppression', 'Fermer', { duration: 3000 });
    } finally {
      this.saving = false;
    }
  }

  // --- Mesures
  openMeasurementDialog() {
    const wt = this.waterType;
    const ref = this.dialog.open(MeasurementDialogComponent, {
      width: '720px',
      data: { aquariumId: this.id, type: wt }
    });
    ref.afterClosed().subscribe((saved: boolean) => {
      if (saved) {
        this.snack.open('Paramètres enregistrés ✅', 'OK', { duration: 2000 });
        this.reloadMeasurements();
      }
    });
  }
  reloadMeasurements() {
    // à implémenter si besoin
  }

  // --- Dialog “Modifier l’aquarium” (les champs de ta capture)
  openEditDialog() {
    const v = this.form.getRawValue();
    const ref = this.dialog.open(EditAquariumDialogComponent, {
      width: '720px',
      data: {
        initial: {
          name: v.name || '',
          waterType: (v as any).waterType || 'EAU_DOUCE',
          lengthCm: Number(v.lengthCm) || 0,
          widthCm: Number(v.widthCm) || 0,
          heightCm: Number(v.heightCm) || 0,
          startDate: (v as any).startDate || '',
        }
      }
    });

    ref.afterClosed().subscribe((result) => {
      if (!result) return; // annulé
      this.form.patchValue({
        name: result.name,
        waterType: result.waterType,
        lengthCm: Number(result.lengthCm) || 0,
        widthCm: Number(result.widthCm) || 0,
        heightCm: Number(result.heightCm) || 0,
        startDate: result.startDate || '',
      });
      this.form.markAsDirty();
    });
  }

  // --- Espèces (local / provisoire)
  addSpecies() {
    const name = (window.prompt('Nom de l’espèce :') || '').trim();
    if (!name) return;
    const countStr = window.prompt('Quantité :') || '1';
    const count = Math.max(1, Number(countStr) || 1);
    this.species = [...this.species, { name, count }];
  }
  removeSpecies(i: number) {
    this.species = this.species.filter((_, idx) => idx !== i);
  }
}
