import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

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
import { MatMenuModule } from '@angular/material/menu';
import { MatTableModule } from '@angular/material/table';

import { AquariumsService, Aquarium } from '../../../core/aquariums.service';
import { WaterMeasurementsChartComponent } from './chart/chart.component';
import { MeasurementDialogComponent } from './measurement-dialog.component';
import { EditAquariumDialogComponent } from './edit-aquarium-dialog.component';
import { AquariumAddItemDialogComponent } from './dialog_ajout/aquarium-add-item-dialog.component';

type WaterType = 'EAU_DOUCE' | 'EAU_DE_MER';

export interface WaterMeasurement {
  id: number;
  aquariumId: number;
  measuredAt: string;
  ph?: number | null;
  temp?: number | null;
  no2?: number | null;
  no3?: number | null;
  kh?: number | null;
  gh?: number | null;
  co2?: number | null;
  po4?: number | null;
  fe?: number | null;
  k?: number | null;
  sio2?: number | null;
  nh3?: number | null;
  dkh?: number | null;
  salinity?: number | null;
  ca?: number | null;
  mg?: number | null;
}

type AquariumFishRow = {
  id: number;
  aquariumId: number;
  count: number;
  fishCard: {
    id: number;
    commonName: string;
    scientificName?: string | null;
    imageUrl?: string | null;

    tempMin?: number | null;
    tempMax?: number | null;
    phMin?: number | null;
    phMax?: number | null;
    khMin?: number | null;
    khMax?: number | null;
  };
};

type AquariumPlantRow = {
  id: number;
  aquariumId: number;
  count: number;
  plantCard: { id: number; commonName: string; scientificName?: string | null; imageUrl?: string | null };
};

@Component({
  selector: 'app-aquarium-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,

    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatDialogModule,
    MatTabsModule,
    MatListModule,
    MatMenuModule,
    MatTableModule,

    WaterMeasurementsChartComponent,
  ],
  templateUrl: './aquarium-detail.component.html',
  styleUrls: ['./aquarium-detail.component.scss'],
})
export class AquariumDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(AquariumsService);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  /** ✅ Origin API sans /api (car tes uploads sont servis sur /uploads hors /api) */
  private readonly apiOrigin = (environment.apiUrl || '')
    .replace(/\/$/, '')
    .replace(/\/api$/, '')
    .replace(/\/api\/$/, '');

  id!: number;
  loading = true;
  saving = false;

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    lengthCm: [0, [Validators.required, Validators.min(1)]],
    widthCm: [0, [Validators.required, Validators.min(1)]],
    heightCm: [0, [Validators.required, Validators.min(1)]],
    waterType: ['EAU_DOUCE' as WaterType, Validators.required],
    startDate: [''],
  });

  measurements: WaterMeasurement[] = [];

  limitOptions = [5, 10, 20, 0];
  selectedLimit = 5;
  displayedMeasurements: WaterMeasurement[] = [];

  fishInTank: AquariumFishRow[] = [];
  plantsInTank: AquariumPlantRow[] = [];

  get displayedColumns(): string[] {
    const base = ['measuredAt', 'ph', 'temp', 'no2', 'no3'];
    const douce = ['kh', 'gh', 'po4', 'fe', 'k'];
    const mer = ['dkh', 'salinity'];
    return [...base, ...(this.waterType === 'EAU_DOUCE' ? douce : mer), 'actions'];
  }

  async ngOnInit() {
    this.id = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.id) {
      this.snack.open('ID aquarium invalide', 'Fermer', { duration: 3000 });
      this.router.navigate(['/aquariums']);
      return;
    }

    await this.load();
    await this.loadMeasurements();
    await this.loadTankItems();
  }

  /** ✅ Construit l’URL d’image */
  fishImageUrl(row: AquariumFishRow): string | null {
    const p = row?.fishCard?.imageUrl?.trim();
    if (!p) return null;

    // déjà absolu
    if (/^https?:\/\//i.test(p)) return p;

    // p = "/uploads/..."
    if (p.startsWith('/')) return `${this.apiOrigin}${p}`;

    return `${this.apiOrigin}/${p}`;
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

  openMeasurementDialog() {
    const wt = this.waterType;
    const ref = this.dialog.open(MeasurementDialogComponent, {
      width: '720px',
      data: { aquariumId: this.id, type: wt },
    });

    ref.afterClosed().subscribe(async (saved: boolean) => {
      if (saved) {
        this.snack.open('Paramètres enregistrés ✅', 'OK', { duration: 2000 });
        await this.reloadMeasurements();
      }
    });
  }

  applyLimit() {
    this.displayedMeasurements =
      this.selectedLimit === 0 ? this.measurements : this.measurements.slice(0, this.selectedLimit);
  }

  async loadMeasurements() {
    try {
      const url = `${environment.apiUrl}/aquariums/${this.id}/measurements`;
      const res = await firstValueFrom(this.http.get<WaterMeasurement[]>(url));
      this.measurements = [...(res ?? [])].sort(
        (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
      );
      this.applyLimit();
    } catch {
      this.snack.open('Erreur lors du chargement des mesures', 'Fermer', { duration: 3000 });
    }
  }

  async deleteMeasurement(id: number) {
    if (!confirm('Supprimer cette mesure ?')) return;
    try {
      const url = `${environment.apiUrl}/aquariums/${this.id}/measurements/${id}`;
      await firstValueFrom(this.http.delete<void>(url));
      this.snack.open('Mesure supprimée', 'OK', { duration: 2000 });
      await this.loadMeasurements();
    } catch {
      this.snack.open('Échec de la suppression', 'Fermer', { duration: 3000 });
    }
  }

  async reloadMeasurements() {
    await this.loadMeasurements();
  }

  async loadTankItems() {
    try {
      const fishUrl = `${environment.apiUrl}/aquariums/${this.id}/fish`;
      const plantUrl = `${environment.apiUrl}/aquariums/${this.id}/plants`;

      const [fish, plants] = await Promise.all([
        firstValueFrom(this.http.get<AquariumFishRow[]>(fishUrl)),
        firstValueFrom(this.http.get<AquariumPlantRow[]>(plantUrl)),
      ]);

      this.fishInTank = fish ?? [];
      this.plantsInTank = plants ?? [];
    } catch {
      this.snack.open('Erreur lors du chargement des espèces/plantes', 'Fermer', { duration: 3000 });
    }
  }

  fishDetailsLink(cardId: number): any[] {
    return ['/fish-cards', cardId];
  }

  plantDetailsLink(cardId: number): any[] {
    return ['/plant-cards', cardId];
  }

  onRemoveFishClick(ev: MouseEvent, rowId: number) {
    ev.preventDefault();
    ev.stopPropagation();
    this.removeFishRow(rowId);
  }

  onRemovePlantClick(ev: MouseEvent, rowId: number) {
    ev.preventDefault();
    ev.stopPropagation();
    this.removePlantRow(rowId);
  }

  openAddDialog() {
    const ref = this.dialog.open(AquariumAddItemDialogComponent, {
      width: '720px',
      data: { aquariumId: this.id },
      autoFocus: false,
      restoreFocus: false,
    });

    ref.afterClosed().subscribe(
      async (res: null | { kind: 'FISH' | 'PLANT'; cardId: number; count: number }) => {
        if (!res) return;

        try {
          if (res.kind === 'FISH') {
            const url = `${environment.apiUrl}/aquariums/${this.id}/fish`;
            await firstValueFrom(this.http.post(url, { cardId: res.cardId, count: res.count }));
          } else {
            const url = `${environment.apiUrl}/aquariums/${this.id}/plants`;
            await firstValueFrom(this.http.post(url, { cardId: res.cardId, count: res.count }));
          }

          this.snack.open('Ajouté ✅', 'OK', { duration: 1800 });
          await this.loadTankItems();
        } catch {
          this.snack.open("Échec de l'ajout", 'Fermer', { duration: 2500 });
        }
      }
    );
  }

  async removeFishRow(rowId: number) {
    if (!confirm('Supprimer cet élément ?')) return;
    try {
      const url = `${environment.apiUrl}/aquariums/${this.id}/fish/${rowId}`;
      await firstValueFrom(this.http.delete(url));
      await this.loadTankItems();
    } catch {
      this.snack.open('Suppression impossible', 'Fermer', { duration: 2500 });
    }
  }

  async removePlantRow(rowId: number) {
    if (!confirm('Supprimer cet élément ?')) return;
    try {
      const url = `${environment.apiUrl}/aquariums/${this.id}/plants/${rowId}`;
      await firstValueFrom(this.http.delete(url));
      await this.loadTankItems();
    } catch {
      this.snack.open('Suppression impossible', 'Fermer', { duration: 2500 });
    }
  }

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
        },
      },
    });

    ref.afterClosed().subscribe(async (result) => {
      if (!result) return;

      if (result.delete === true) {
        await this.remove();
        return;
      }

      this.form.patchValue({
        name: result.name,
        waterType: result.waterType,
        lengthCm: Number(result.lengthCm) || 0,
        widthCm: Number(result.widthCm) || 0,
        heightCm: Number(result.heightCm) || 0,
        startDate: result.startDate ?? '',
      });

      await this.save();
    });
  }
}
