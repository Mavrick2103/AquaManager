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

import { AquariumsService, Aquarium } from '../../../core/aquariums.service';
import type { WaterType } from '../../../core/water.service';
import { WaterMeasurementsChartComponent } from '../../../pages/aquariums/detail/chart/chart.component';
// ✅ Dialog de saisie de mesure (à créer si pas encore fait)
import { MeasurementDialogComponent } from './measurement-dialog.component';

@Component({
  selector: 'app-aquarium-detail',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatSnackBarModule, MatDividerModule,
    MatProgressSpinnerModule, MatChipsModule, MatDialogModule, WaterMeasurementsChartComponent,
  ],
  templateUrl: './aquarium-detail.component.html',
  styleUrls: ['./aquarium-detail.component.scss']
})
export class AquariumDetailComponent implements OnInit {
  private route  = inject(ActivatedRoute);
  private api    = inject(AquariumsService);
  private fb     = inject(FormBuilder);
  private snack  = inject(MatSnackBar);
  private router = inject(Router);
  private dialog = inject(MatDialog);              // ✅ injection du dialog

  id!: number;
  loading = true;
  saving  = false;

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    lengthCm: [0, [Validators.required, Validators.min(1)]],
    widthCm:  [0, [Validators.required, Validators.min(1)]],
    heightCm: [0, [Validators.required, Validators.min(1)]],
    // 🟩 Ton type existant (on ne redemande pas) : 'EAU_DOUCE' | 'EAU_DE_MER'
    waterType: ['EAU_DOUCE' as 'EAU_DOUCE' | 'EAU_DE_MER', Validators.required],
    startDate: ['']
  });

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

  openMeasurementDialog() {
  const v = this.form.value;
  const waterType = v.waterType as 'EAU_DOUCE' | 'EAU_DE_MER';

  const ref = this.dialog.open(MeasurementDialogComponent, {
    width: '560px',
    disableClose: true,
    data: { aquariumId: this.id, type: waterType, name: v.name || undefined },
  });

  ref.afterClosed().subscribe(saved => {
    if (saved) {
      this.snack.open('Paramètres enregistrés ✅', 'OK', { duration: 2000 });
      this.reloadMeasurements();
    }
  });
}


  // 👉 Implémente ici l’appel à ton service de mesures pour recharger l’historique + MAJ des charts
  reloadMeasurements() {
    // ex:
    // this.measurementsService.listForAquarium(this.id).then(data => {
    //   this.measurements = data;
    //   this.updateCharts();
    // });
  }
  // ✅ Getter propre pour le binding
  get waterType(): 'EAU_DOUCE' | 'EAU_DE_MER' {
    // on renvoie juste la valeur du form, sans cast dans le template
    return (this.form.value.waterType as 'EAU_DOUCE' | 'EAU_DE_MER') ?? 'EAU_DOUCE';
  }
}
