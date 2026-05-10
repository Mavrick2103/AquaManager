import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { BillingService } from '../../../core/billing.service';
import { RecommendationScheduleDialogComponent } from './recommendation-schedule-dialog.component';

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
import { MatExpansionModule } from '@angular/material/expansion';
import { MatBadgeModule } from '@angular/material/badge';

import { AquariumsService, Aquarium } from '../../../core/aquariums.service';
import { WaterMeasurementsChartComponent } from './chart/chart.component';
import { MeasurementDialogComponent } from './measurement-dialog.component';
import { EditAquariumDialogComponent } from './edit-aquarium-dialog.component';
import { AquariumAddItemDialogComponent } from './dialog_ajout/aquarium-add-item-dialog.component';

import {
  RecommendationsService,
  Recommendation,
} from '../../../core/recommendations.service';

import {
  AquariumTargetsService,
  AquariumTargetsDto,
  ALL_PARAMS,
  PARAM_LABELS,
  PROFILE_LABELS,
  ParamKey,
  TargetProfileKey,
  TargetRange,
  TargetsJson,
} from '../../../core/aquarium-targets.service';

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
    slug?: string | null;
    commonName: string;
    scientificName?: string | null;
    imageUrl?: string | null;

    tempMin?: number | string | null;
    tempMax?: number | string | null;
    phMin?: number | string | null;
    phMax?: number | string | null;
    ghMin?: number | string | null;
    ghMax?: number | string | null;
    khMin?: number | string | null;
    khMax?: number | string | null;
  };
};

type AquariumPlantRow = {
  id: number;
  aquariumId: number;
  count: number;
  plantCard: {
    id: number;
    slug?: string | null;
    commonName: string;
    scientificName?: string | null;
    imageUrl?: string | null;

    tempMin?: number | string | null;
    tempMax?: number | string | null;
    phMin?: number | string | null;
    phMax?: number | string | null;
    ghMin?: number | string | null;
    ghMax?: number | string | null;
    khMin?: number | string | null;
    khMax?: number | string | null;
  };
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
    MatExpansionModule,
    MatBadgeModule,

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
  private recosApi = inject(RecommendationsService);
  private targetsApi = inject(AquariumTargetsService);
  private billing = inject(BillingService);

  private readonly apiOrigin = (environment.apiUrl || '')
    .replace(/\/$/, '')
    .replace(/\/api$/, '')
    .replace(/\/api\/$/, '');

  id!: number;
  loading = true;
  saving = false;

  isPremium = false;
  private solutionsLoadedOnce = false;

  checkoutLoading = false;

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    lengthCm: [0, [Validators.required, Validators.min(1)]],
    widthCm: [0, [Validators.required, Validators.min(1)]],
    heightCm: [0, [Validators.required, Validators.min(1)]],
    waterType: ['EAU_DOUCE' as WaterType, Validators.required],
    startDate: [''],
  });

  measurements: WaterMeasurement[] = [];

  recosLoading = false;
  recos: Recommendation[] = [];

  targetsLoading = false;
  targets: AquariumTargetsDto | null = null;
  targetsForm: FormGroup | null = null;

  readonly profileLabels = PROFILE_LABELS;
  readonly paramLabels = PARAM_LABELS;

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

  get allParams(): ParamKey[] {
    const commons: ParamKey[] = ['ph', 'temp', 'no2', 'no3', 'nh3'];
    const fresh: ParamKey[] = ['kh', 'gh', 'co2', 'po4', 'fe', 'k', 'sio2'];
    const salt: ParamKey[] = ['dkh', 'salinity', 'ca', 'mg'];

    return this.waterType === 'EAU_DOUCE'
      ? [...commons, ...fresh]
      : [...commons, ...salt];
  }

  get targetsGroup(): FormGroup | null {
    return (this.targetsForm?.get('targets') as FormGroup) ?? null;
  }

  get profileOptions(): TargetProfileKey[] {
    return this.waterType === 'EAU_DOUCE'
      ? ([
          'FRESH_COMMUNITY',
          'FRESH_PLANTED',
          'FRESH_SHRIMP',
          'FRESH_CICHLID',
          'CUSTOM',
        ] as TargetProfileKey[])
      : (['SALT_REEF', 'SALT_FISH_ONLY', 'CUSTOM'] as TargetProfileKey[]);
  }

  async ngOnInit(): Promise<void> {
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

  getProfileLabel(key?: TargetProfileKey | null): string {
    const k = (key ??
      (this.targets?.profileKey as TargetProfileKey | undefined) ??
      'CUSTOM') as TargetProfileKey;

    return this.profileLabels[k] ?? 'Custom';
  }

  private getRange(key: ParamKey): TargetRange | null {
    const t = this.targets?.targets as any;
    const r = t?.[key] as TargetRange | undefined;

    return r ?? null;
  }

  getTargetMin(key: ParamKey): string {
    const r = this.getRange(key);
    const v = r?.min;

    return v === null || v === undefined ? '—' : String(v);
  }

  getTargetMax(key: ParamKey): string {
    const r = this.getRange(key);
    const v = r?.max;

    return v === null || v === undefined ? '—' : String(v);
  }

  async startPremiumCheckout(): Promise<void> {
    if (this.checkoutLoading) return;

    this.checkoutLoading = true;

    try {
      const url = await this.billing.createPremiumCheckout();
      window.location.href = url;
    } catch (e) {
      console.error(e);
      this.snack.open("Impossible d'ouvrir le paiement Stripe", 'Fermer', {
        duration: 3000,
      });
    } finally {
      this.checkoutLoading = false;
    }
  }

  async onTabChange(index: number): Promise<void> {
    if (index !== 1) return;
    if (this.solutionsLoadedOnce) return;

    this.solutionsLoadedOnce = true;
    await this.detectPremiumAndLoadSolutions();
  }

  private async detectPremiumAndLoadSolutions(): Promise<void> {
    this.targetsLoading = true;

    try {
      this.targets = await this.targetsApi.getForAquarium(this.id);
      this.isPremium = true;
      this.buildTargetsForm(this.targets);
    } catch (e: any) {
      const status = e?.status ?? e?.error?.statusCode;

      this.isPremium = false;
      this.targets = null;
      this.targetsForm = null;
      this.recos = [];

      if (status !== 403) {
        this.snack.open('Impossible de charger les solutions pour le moment', 'Fermer', {
          duration: 3000,
        });
      }

      return;
    } finally {
      this.targetsLoading = false;
    }

    await this.loadPendingRecos();
  }

  private buildTargetsForm(dto: AquariumTargetsDto): void {
    const profileKey = (dto?.profileKey ?? 'CUSTOM') as TargetProfileKey;
    const targets = dto?.targets ?? {};

    const group: Record<string, FormGroup> = {};

    for (const k of ALL_PARAMS) {
      const v = (targets as any)?.[k] as TargetRange | undefined;

      group[k] = this.fb.group({
        min: [v?.min ?? null],
        max: [v?.max ?? null],
      });
    }

    this.targetsForm = this.fb.group({
      profileKey: [profileKey],
      targets: this.fb.group(group),
    });
  }

  async applyTargetProfile(profileKey: TargetProfileKey): Promise<void> {
    if (!this.isPremium) return;

    this.targetsLoading = true;

    try {
      const dto = await this.targetsApi.updateForAquarium(this.id, { profileKey });

      this.targets = dto;
      this.buildTargetsForm(dto);

      this.snack.open('Profil appliqué ✅', 'OK', { duration: 1800 });

      await this.loadPendingRecos();
    } catch (e) {
      console.error(e);
      this.snack.open("Impossible d'appliquer le profil", 'Fermer', {
        duration: 2500,
      });
    } finally {
      this.targetsLoading = false;
    }
  }

  async saveCustomTargets(): Promise<void> {
    if (!this.isPremium || !this.targetsForm) return;

    const raw = this.targetsForm.getRawValue() as any;
    const formTargets = raw.targets ?? {};

    const cleaned: TargetsJson = {};

    for (const k of ALL_PARAMS) {
      const row = formTargets?.[k];

      const min = row?.min;
      const max = row?.max;

      const hasMin = min !== null && min !== undefined && min !== '';
      const hasMax = max !== null && max !== undefined && max !== '';

      if (hasMin || hasMax) {
        (cleaned as any)[k] = {
          min: hasMin ? Number(min) : null,
          max: hasMax ? Number(max) : null,
        };
      }
    }

    this.targetsLoading = true;

    try {
      const dto = await this.targetsApi.updateForAquarium(this.id, {
        profileKey: 'CUSTOM',
        targets: cleaned,
      });

      this.targets = dto;
      this.buildTargetsForm(dto);

      this.snack.open('Objectifs sauvegardés ✅', 'OK', { duration: 2000 });

      await this.loadPendingRecos();
    } catch (e) {
      console.error(e);
      this.snack.open('Impossible de sauvegarder les objectifs', 'Fermer', {
        duration: 3000,
      });
    } finally {
      this.targetsLoading = false;
    }
  }

  async loadPendingRecos(): Promise<void> {
    if (!this.isPremium) return;

    this.recosLoading = true;

    try {
      const list = await this.recosApi.listPending(this.id);
      this.recos = Array.isArray(list) ? list : [];
    } catch (e: any) {
      const status = e?.status ?? e?.error?.statusCode;

      if (status === 403) {
        this.isPremium = false;
        this.recos = [];
      } else {
        this.snack.open('Impossible de charger les solutions', 'Fermer', {
          duration: 3000,
        });
      }
    } finally {
      this.recosLoading = false;
    }
  }

  async refreshSolutions(): Promise<void> {
    if (!this.isPremium) return;

    await this.loadTargets();
    await this.loadPendingRecos();
  }

  async acceptReco(r: Recommendation): Promise<void> {
    if (!this.isPremium) return;

    const initial = (r as any)?.actionPayload?.dueAt ?? null;

    const ref = this.dialog.open(RecommendationScheduleDialogComponent, {
      width: '520px',
      data: {
        title: r.title,
        message: r.message,
        initialDueAt: initial,
      },
      autoFocus: false,
      restoreFocus: false,
    });

    const res = await firstValueFrom(ref.afterClosed());

    if (!res?.dueAt) return;

    try {
      await this.recosApi.accept(r.id, { dueAt: res.dueAt });

      this.snack.open('Solution acceptée ✅ (tâche créée)', 'OK', {
        duration: 2500,
      });

      await this.loadPendingRecos();
    } catch (e: any) {
      this.snack.open(e?.error?.message || 'Impossible d’accepter', 'Fermer', {
        duration: 3000,
      });
    }
  }

  async rejectReco(id: number): Promise<void> {
    if (!this.isPremium) return;

    try {
      await this.recosApi.reject(id);

      this.snack.open('Solution refusée', 'OK', { duration: 2000 });

      await this.loadPendingRecos();
    } catch (e: any) {
      this.snack.open(e?.error?.message || 'Impossible de refuser', 'Fermer', {
        duration: 3000,
      });
    }
  }

  severityLabel(s: Recommendation['severity']): string {
    if (s === 'URGENT') return 'Urgent';
    if (s === 'WARN') return 'Attention';

    return 'Info';
  }

  async loadTargets(): Promise<void> {
    if (!this.isPremium) return;

    this.targetsLoading = true;

    try {
      const dto = await this.targetsApi.getForAquarium(this.id);

      this.targets = dto;
      this.buildTargetsForm(dto);
    } catch (e: any) {
      const status = e?.status ?? e?.error?.statusCode;

      if (status === 403) {
        this.isPremium = false;
      }

      this.targets = null;
      this.targetsForm = null;
    } finally {
      this.targetsLoading = false;
    }
  }

  goToPricing(): void {
    this.router.navigate(['/pricing']);
  }

  fishImageUrl(row: AquariumFishRow): string | null {
    const p = row?.fishCard?.imageUrl?.trim();

    if (!p) return null;
    if (/^https?:\/\//i.test(p)) return p;
    if (p.startsWith('/')) return `${this.apiOrigin}${p}`;

    return `${this.apiOrigin}/${p}`;
  }

  plantImageUrl(row: AquariumPlantRow): string | null {
    const p = row?.plantCard?.imageUrl?.trim();

    if (!p) return null;
    if (/^https?:\/\//i.test(p)) return p;
    if (p.startsWith('/')) return `${this.apiOrigin}${p}`;

    return `${this.apiOrigin}/${p}`;
  }

  async load(): Promise<void> {
    this.loading = true;

    try {
      const a = await firstValueFrom(this.api.getById(this.id));

      if (a) this.form.patchValue(a as any);
    } catch {
      this.snack.open('Impossible de charger cet aquarium', 'Fermer', {
        duration: 3000,
      });

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

  async save(): Promise<void> {
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

  async remove(): Promise<void> {
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

  openMeasurementDialog(): void {
    const ref = this.dialog.open(MeasurementDialogComponent, {
      width: '720px',
      data: {
        aquariumId: this.id,
        type: this.waterType,
      },
    });

    ref.afterClosed().subscribe(async (saved: boolean) => {
      if (!saved) return;

      this.snack.open('Paramètres enregistrés ✅', 'OK', {
        duration: 2000,
      });

      await this.reloadMeasurements();

      if (this.isPremium) {
        await this.loadPendingRecos();
      }
    });
  }

  applyLimit(): void {
    this.displayedMeasurements =
      this.selectedLimit === 0
        ? this.measurements
        : this.measurements.slice(0, this.selectedLimit);
  }

  async loadMeasurements(): Promise<void> {
    try {
      const url = `${environment.apiUrl}/aquariums/${this.id}/measurements`;
      const res = await firstValueFrom(this.http.get<WaterMeasurement[]>(url));

      this.measurements = [...(res ?? [])].sort(
        (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
      );

      this.applyLimit();
    } catch {
      this.snack.open('Erreur lors du chargement des mesures', 'Fermer', {
        duration: 3000,
      });
    }
  }

  async deleteMeasurement(id: number): Promise<void> {
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

  async reloadMeasurements(): Promise<void> {
    await this.loadMeasurements();
  }

  async loadTankItems(): Promise<void> {
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
      this.snack.open('Erreur lors du chargement des espèces/plantes', 'Fermer', {
        duration: 3000,
      });
    }
  }

  fishDetailsLink(fish: AquariumFishRow['fishCard']): any[] {
    return ['/poissons', fish.slug || fish.id];
  }

  plantDetailsLink(plant: AquariumPlantRow['plantCard']): any[] {
    return ['/plantes', plant.slug || plant.id];
  }

  onRemoveFishClick(ev: MouseEvent, rowId: number): void {
    ev.preventDefault();
    ev.stopPropagation();

    this.removeFishRow(rowId);
  }

  onRemovePlantClick(ev: MouseEvent, rowId: number): void {
    ev.preventDefault();
    ev.stopPropagation();

    this.removePlantRow(rowId);
  }

  openAddDialog(): void {
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

            await firstValueFrom(
              this.http.post(url, {
                cardId: res.cardId,
                count: res.count,
              }),
            );
          } else {
            const url = `${environment.apiUrl}/aquariums/${this.id}/plants`;

            await firstValueFrom(
              this.http.post(url, {
                cardId: res.cardId,
                count: res.count,
              }),
            );
          }

          this.snack.open('Ajouté ✅', 'OK', { duration: 1800 });

          await this.loadTankItems();

          if (this.isPremium) {
            await this.loadPendingRecos();
          }
        } catch {
          this.snack.open("Échec de l'ajout", 'Fermer', { duration: 2500 });
        }
      },
    );
  }

  async removeFishRow(rowId: number): Promise<void> {
    if (!confirm('Supprimer cet élément ?')) return;

    try {
      const url = `${environment.apiUrl}/aquariums/${this.id}/fish/${rowId}`;

      await firstValueFrom(this.http.delete(url));
      await this.loadTankItems();

      if (this.isPremium) {
        await this.loadPendingRecos();
      }
    } catch {
      this.snack.open('Suppression impossible', 'Fermer', { duration: 2500 });
    }
  }

  async removePlantRow(rowId: number): Promise<void> {
    if (!confirm('Supprimer cet élément ?')) return;

    try {
      const url = `${environment.apiUrl}/aquariums/${this.id}/plants/${rowId}`;

      await firstValueFrom(this.http.delete(url));
      await this.loadTankItems();

      if (this.isPremium) {
        await this.loadPendingRecos();
      }
    } catch {
      this.snack.open('Suppression impossible', 'Fermer', { duration: 2500 });
    }
  }

  private toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;

    const n = Number(value);

    return Number.isFinite(n) ? n : null;
  }

  private roundTarget(value: number): number {
    return Math.round(value * 10) / 10;
  }

  private addWeightedRange(
    collector: Record<string, { minSum: number; maxSum: number; weightSum: number }>,
    key: ParamKey,
    min: unknown,
    max: unknown,
    weight: number,
  ): void {
    const minValue = this.toNumber(min);
    const maxValue = this.toNumber(max);

    if (minValue === null && maxValue === null) return;

    const safeMin = minValue ?? maxValue;
    const safeMax = maxValue ?? minValue;

    if (safeMin === null || safeMax === null) return;

    if (!collector[key]) {
      collector[key] = {
        minSum: 0,
        maxSum: 0,
        weightSum: 0,
      };
    }

    collector[key].minSum += safeMin * weight;
    collector[key].maxSum += safeMax * weight;
    collector[key].weightSum += weight;
  }

  private buildSpeciesAverageTargets(): TargetsJson {
    const collector: Record<string, { minSum: number; maxSum: number; weightSum: number }> = {};

    for (const row of this.fishInTank) {
      const fish = row.fishCard;
      const weight = Math.max(1, Number(row.count) || 1);

      this.addWeightedRange(collector, 'temp', fish.tempMin, fish.tempMax, weight);
      this.addWeightedRange(collector, 'ph', fish.phMin, fish.phMax, weight);
      this.addWeightedRange(collector, 'gh', fish.ghMin, fish.ghMax, weight);
      this.addWeightedRange(collector, 'kh', fish.khMin, fish.khMax, weight);
    }

    for (const row of this.plantsInTank) {
      const plant = row.plantCard;
      const weight = Math.max(1, Number(row.count) || 1);

      this.addWeightedRange(collector, 'temp', plant.tempMin, plant.tempMax, weight);
      this.addWeightedRange(collector, 'ph', plant.phMin, plant.phMax, weight);
      this.addWeightedRange(collector, 'gh', plant.ghMin, plant.ghMax, weight);
      this.addWeightedRange(collector, 'kh', plant.khMin, plant.khMax, weight);
    }

    const targets: TargetsJson = {};

    for (const key of Object.keys(collector) as ParamKey[]) {
      const row = collector[key];

      if (!row || row.weightSum <= 0) continue;

      (targets as any)[key] = {
        min: this.roundTarget(row.minSum / row.weightSum),
        max: this.roundTarget(row.maxSum / row.weightSum),
      };
    }

    if (this.waterType === 'EAU_DOUCE') {
      (targets as any).no2 = { min: 0, max: 0 };
      (targets as any).nh3 = { min: 0, max: 0 };
    }

    return targets;
  }

  get hasSpeciesAverageTargets(): boolean {
    const targets = this.buildSpeciesAverageTargets();

    return Object.keys(targets).length > 0;
  }

  get speciesAveragePreview(): TargetsJson {
    return this.buildSpeciesAverageTargets();
  }

  async applySpeciesAverageTargets(): Promise<void> {
    if (!this.isPremium) return;

    const targets = this.buildSpeciesAverageTargets();

    if (!Object.keys(targets).length) {
      this.snack.open('Aucune donnée suffisante sur les espèces du bac', 'Fermer', {
        duration: 2500,
      });

      return;
    }

    this.targetsLoading = true;

    try {
      const dto = await this.targetsApi.updateForAquarium(this.id, {
        profileKey: 'CUSTOM',
        targets,
      });

      this.targets = dto;
      this.buildTargetsForm(dto);

      this.snack.open('Objectifs calculés depuis les espèces ✅', 'OK', {
        duration: 2500,
      });

      await this.loadPendingRecos();
    } catch (e) {
      console.error(e);

      this.snack.open('Impossible d’appliquer les objectifs du bac', 'Fermer', {
        duration: 3000,
      });
    } finally {
      this.targetsLoading = false;
    }
  }

  get lastMeasurement(): WaterMeasurement | null {
    return this.measurements?.length ? this.measurements[0] : null;
  }

  private inRange(value: number, min?: number | null, max?: number | null): boolean {
    if (min !== null && min !== undefined && value < min) return false;
    if (max !== null && max !== undefined && value > max) return false;

    return true;
  }

  get outOfTargetParams(): Array<{
    key: ParamKey;
    value: number;
    min: number | null;
    max: number | null;
  }> {
    if (!this.isPremium) return [];
    if (!this.targets?.targets) return [];

    const m = this.lastMeasurement;

    if (!m) return [];

    const outs: Array<{
      key: ParamKey;
      value: number;
      min: number | null;
      max: number | null;
    }> = [];

    for (const key of this.allParams) {
      const val = (m as any)[key] as number | null | undefined;

      if (val === null || val === undefined) continue;

      const r = (this.targets.targets as any)?.[key] as TargetRange | undefined;

      if (!r) continue;

      const min = r.min ?? null;
      const max = r.max ?? null;

      if (!this.inRange(Number(val), min, max)) {
        outs.push({
          key,
          value: Number(val),
          min,
          max,
        });
      }
    }

    return outs;
  }

  get isTankHealthy(): boolean {
    if (!this.isPremium) return false;
    if (this.recosLoading || this.targetsLoading) return false;
    if (!this.targets || !this.targetsForm) return false;
    if (!this.lastMeasurement) return false;
    if (this.recos?.length) return false;

    return this.outOfTargetParams.length === 0;
  }

  openEditDialog(): void {
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