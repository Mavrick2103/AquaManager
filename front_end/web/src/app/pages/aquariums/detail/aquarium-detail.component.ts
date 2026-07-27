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
import { FormsModule } from '@angular/forms';

import { AquariumsService, Aquarium } from '../../../core/aquariums.service';
import {
  MaintenanceEvent,
  MetricKey,
  WaterMeasurementsChartComponent,
} from './chart/chart.component';
import {
  ChartDetailDialogComponent,
  ChartDetailDialogData,
} from './chart/chart-detail-dialog.component';
import { MeasurementDialogComponent } from './measurement-dialog.component';
import { EditAquariumDialogComponent } from './edit-aquarium-dialog.component';
import { AquariumAddItemDialogComponent } from './dialog_ajout/aquarium-add-item-dialog.component';
import { AquariumProtocolsComponent } from './protocols/aquarium-protocols.component';
import { AquariumTasksComponent } from './tasks/aquarium-tasks.component';

import {
  RecommendationsService,
  Recommendation,
} from '../../../core/recommendations.service';

import {
  AiApi,
  AiAquariumAnalysisResponse,
  AiSuggestedTask,
} from '../../../core/ai.service';
import { Task, TasksService } from '../../../core/tasks.service';
import { UserService } from '../../../core/user.service';

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
type ChartGroupKey = 'essential' | 'balance' | 'plants' | 'marine';
type ChartMetricConfig = {
  metric: MetricKey;
  targetKey: ParamKey;
  label: string;
  group: ChartGroupKey;
};
type MaintenanceImpact = {
  key: MetricKey;
  label: string;
  unit: string;
  before: number;
  after: number;
  delta: number;
  percent: number | null;
};
type HistoryMetricView = {
  key: MetricKey;
  label: string;
  value: number;
  unit: string;
  status: 'ok' | 'warning' | 'unknown';
};
type MeasurementHistoryView = {
  measurement: WaterMeasurement;
  metrics: HistoryMetricView[];
  evaluated: number;
  warnings: number;
  unknown: number;
  status: 'ok' | 'warning' | 'unknown';
};

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
    FormsModule,

    WaterMeasurementsChartComponent,
    AquariumProtocolsComponent,
    AquariumTasksComponent,
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
  private aiApi = inject(AiApi);
  private tasksApi = inject(TasksService);
  private usersApi = inject(UserService);

  private readonly apiOrigin = (environment.apiUrl || '')
    .replace(/\/$/, '')
    .replace(/\/api$/, '')
    .replace(/\/api\/$/, '');

  id!: number;
  loading = true;
  saving = false;
  protocolAquarium: Aquarium | null = null;

  isPremium = false;
  solutionView: 'assistant' | 'ai' = 'assistant';
  selectedTabIndex = 0;
  initialProtocolKey: 'STARTUP' | null = null;
  targetPanelExpanded = false;
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
  maintenanceEvents: MaintenanceEvent[] = [];
  maintenanceImpacts: Record<string, MaintenanceImpact[]> = {};
  showMaintenanceMarkers = true;
  chartPeriodDays = 30;
  chartSortAlertsFirst = false;
  readonly chartPeriods = [
    { label: '7 jours', days: 7 },
    { label: '30 jours', days: 30 },
    { label: '3 mois', days: 90 },
    { label: '1 an', days: 365 },
    { label: 'Tout', days: 0 },
  ];
  readonly chartGroups: Array<{
    key: ChartGroupKey;
    title: string;
    subtitle: string;
    icon: string;
  }> = [
    {
      key: 'essential',
      title: 'Paramètres essentiels',
      subtitle: 'Les indicateurs principaux de l’équilibre du bac',
      icon: 'monitor_heart',
    },
    {
      key: 'balance',
      title: 'Équilibre de l’eau',
      subtitle: 'Dureté, minéraux et équilibre chimique',
      icon: 'water',
    },
    {
      key: 'plants',
      title: 'Nutrition des plantes',
      subtitle: 'Éléments utiles au suivi d’un aquarium planté',
      icon: 'eco',
    },
    {
      key: 'marine',
      title: 'Paramètres marins',
      subtitle: 'Salinité et minéraux de l’eau de mer',
      icon: 'waves',
    },
  ];
  readonly chartMetrics: ChartMetricConfig[] = [
    { metric: 'temp', targetKey: 'temp', label: 'Température', group: 'essential' },
    { metric: 'ph', targetKey: 'ph', label: 'pH', group: 'essential' },
    { metric: 'no2', targetKey: 'no2', label: 'NO₂', group: 'essential' },
    { metric: 'no3', targetKey: 'no3', label: 'NO₃', group: 'essential' },
    { metric: 'nh3', targetKey: 'nh3', label: 'Ammoniaque', group: 'essential' },
    { metric: 'kh', targetKey: 'kh', label: 'KH', group: 'balance' },
    { metric: 'gh', targetKey: 'gh', label: 'GH', group: 'balance' },
    { metric: 'co2', targetKey: 'co2', label: 'CO₂ estimé', group: 'balance' },
    { metric: 'po4', targetKey: 'po4', label: 'PO₄', group: 'balance' },
    { metric: 'fe', targetKey: 'fe', label: 'Fer', group: 'plants' },
    { metric: 'k', targetKey: 'k', label: 'Potassium', group: 'plants' },
    { metric: 'sio2', targetKey: 'sio2', label: 'Silicates', group: 'plants' },
    { metric: 'dkh', targetKey: 'dkh', label: 'dKH', group: 'marine' },
    { metric: 'salinity', targetKey: 'salinity', label: 'Salinité', group: 'marine' },
    { metric: 'ca', targetKey: 'ca', label: 'Calcium', group: 'marine' },
    { metric: 'mg', targetKey: 'mg', label: 'Magnésium', group: 'marine' },
  ];

  recosLoading = false;
  recos: Recommendation[] = [];

  aiLoading = false;
aiError = '';
aiAnalysis: AiAquariumAnalysisResponse | null = null;
aiPhotoFile: File | null = null;
aiPhotoPreview = '';
aiPhotoProblemType = 'ALGAE';
aiPhotoQuestion = '';
aiPhotoLoading = false;
aiPhotoError = '';
aiPhotoAnalysis: AiAquariumAnalysisResponse | null = null;
aiChatMessages: {
  role: 'user' | 'assistant';
  content: string;
}[] = [];

aiChatQuestion = '';

  targetsLoading = false;
  targets: AquariumTargetsDto | null = null;
  targetsForm: FormGroup | null = null;

  readonly profileLabels = PROFILE_LABELS;
  readonly paramLabels = PARAM_LABELS;

  limitOptions = [5, 10, 20, 0];
  selectedLimit = 5;
  displayedMeasurements: WaterMeasurement[] = [];
  measurementHistory: MeasurementHistoryView[] = [];

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
    this.initialProtocolKey =
      this.route.snapshot.queryParamMap.get('protocol') === 'STARTUP' ? 'STARTUP' : null;
    if (this.initialProtocolKey) this.selectedTabIndex = 3;

    if (!this.id) {
      this.snack.open('ID aquarium invalide', 'Fermer', { duration: 3000 });
      this.router.navigate(['/aquariums']);
      return;
    }

    await this.load();
    await Promise.all([
      this.loadMeasurements(),
      this.loadMaintenanceEvents(),
      this.loadTargets(),
      this.loadTankItems(),
    ]);

    if (this.route.snapshot.queryParamMap.get('action') === 'measure') {
      window.setTimeout(() => this.openMeasurementDialog(), 0);
    }
  }

  getProfileLabel(key?: TargetProfileKey | null): string {
    const k = (key ??
      (this.targets?.profileKey as TargetProfileKey | undefined) ??
      'CUSTOM') as TargetProfileKey;

    return this.profileLabels[k] ?? 'Custom';
  }

  getRange(key: ParamKey): TargetRange | null {
    const t = this.targets?.targets as any;
    const r = t?.[key] as TargetRange | undefined;

    return r ?? null;
  }

  get visibleChartGroups() {
    const allowed =
      this.waterType === 'EAU_DOUCE'
        ? new Set<ChartGroupKey>(['essential', 'balance', 'plants'])
        : new Set<ChartGroupKey>(['essential', 'marine']);

    return this.chartGroups.filter(group => allowed.has(group.key));
  }

  get chartPeriodLabel(): string {
    return this.chartPeriods.find(period => period.days === this.chartPeriodDays)?.label ?? 'Période';
  }

  get chartPeriodEvents(): MaintenanceEvent[] {
    const cutoff =
      this.chartPeriodDays > 0
        ? Date.now() - this.chartPeriodDays * 24 * 60 * 60 * 1000
        : null;

    return this.maintenanceEvents
      .filter(event => cutoff === null || new Date(event.date).getTime() >= cutoff)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  maintenanceIcon(type: MaintenanceEvent['type']): string {
    if (type === 'WATER_CHANGE') return 'water_drop';
    if (type === 'FERTILIZATION') return 'eco';
    if (type === 'TRIM') return 'content_cut';
    if (type === 'WATER_TEST') return 'science';
    return 'build';
  }

  private calculateMaintenanceImpact(event: MaintenanceEvent): MaintenanceImpact[] {
    const eventTime = new Date(event.date).getTime();
    const maxDistance = 21 * 24 * 60 * 60 * 1000;
    const chronological = [...this.measurements].sort(
      (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
    );
    const before = [...chronological]
      .reverse()
      .find(measurement => new Date(measurement.measuredAt).getTime() < eventTime);
    const after = chronological.find(
      measurement => new Date(measurement.measuredAt).getTime() >= eventTime,
    );

    if (!before || !after) return [];
    if (
      eventTime - new Date(before.measuredAt).getTime() > maxDistance ||
      new Date(after.measuredAt).getTime() - eventTime > maxDistance
    ) {
      return [];
    }

    const preferred: Partial<Record<MaintenanceEvent['type'], MetricKey[]>> = {
      WATER_CHANGE: ['no3', 'no2', 'ph'],
      FERTILIZATION: ['po4', 'k', 'fe'],
      TRIM: ['no3', 'po4', 'ph'],
      WATER_TEST: ['ph', 'temp', 'no2'],
      OTHER: ['no3', 'ph', 'temp'],
    };
    const meta: Partial<Record<MetricKey, { label: string; unit: string }>> = {
      ph: { label: 'pH', unit: '' },
      temp: { label: 'Température', unit: '°C' },
      no2: { label: 'NO₂', unit: 'mg/L' },
      no3: { label: 'NO₃', unit: 'mg/L' },
      po4: { label: 'PO₄', unit: 'mg/L' },
      fe: { label: 'Fer', unit: 'mg/L' },
      k: { label: 'Potassium', unit: 'mg/L' },
    };

    return (preferred[event.type] ?? [])
      .map(key => {
        const beforeValue = before[key as keyof WaterMeasurement];
        const afterValue = after[key as keyof WaterMeasurement];
        if (
          typeof beforeValue !== 'number' ||
          typeof afterValue !== 'number' ||
          !Number.isFinite(beforeValue) ||
          !Number.isFinite(afterValue)
        ) {
          return null;
        }

        const delta = Number((afterValue - beforeValue).toFixed(2));
        return {
          key,
          label: meta[key]?.label ?? key,
          unit: meta[key]?.unit ?? '',
          before: beforeValue,
          after: afterValue,
          delta,
          percent:
            beforeValue === 0
              ? null
              : Math.round(((afterValue - beforeValue) / Math.abs(beforeValue)) * 100),
        };
      })
      .filter((impact): impact is MaintenanceImpact => impact !== null)
      .slice(0, 2);
  }

  formatImpactValue(value: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
  }

  private rebuildMaintenanceImpacts(): void {
    this.maintenanceImpacts = Object.fromEntries(
      this.maintenanceEvents.map(event => [
        event.id,
        this.calculateMaintenanceImpact(event),
      ]),
    );
  }

  get chartSummary(): { measured: number; ok: number; warning: number; unknown: number } {
    const metrics = this.availableChartMetrics;
    let measured = 0;
    let ok = 0;
    let warning = 0;
    let unknown = 0;

    for (const metric of metrics) {
      const value = this.latestMetricValue(metric.metric);
      if (value === null) continue;

      measured += 1;
      const status = this.metricStatus(metric);
      if (status === 'ok') ok += 1;
      else if (status === 'warning') warning += 1;
      else unknown += 1;
    }

    return { measured, ok, warning, unknown };
  }

  get measurementFreshness(): {
    level: 'recent' | 'due' | 'old';
    label: string;
    detail: string;
  } {
    const measuredAt = this.lastMeasurement?.measuredAt;
    const timestamp = measuredAt ? new Date(measuredAt).getTime() : Number.NaN;
    const elapsedDays = Number.isFinite(timestamp)
      ? Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000))
      : 0;
    const detail =
      elapsedDays === 0
        ? "Mesurée aujourd'hui"
        : `Il y a ${elapsedDays} jour${elapsedDays > 1 ? 's' : ''}`;

    if (elapsedDays < 7) return { level: 'recent', label: 'Mesure récente', detail };
    if (elapsedDays <= 14) return { level: 'due', label: 'À renouveler', detail };
    return { level: 'old', label: 'Mesure ancienne', detail };
  }

  openTargetConfiguration(): void {
    this.solutionView = 'assistant';
    this.selectedTabIndex = 2;
    this.targetPanelExpanded = true;

    window.setTimeout(() => {
      document
        .getElementById('aquarium-target-configuration')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
  }

  metricsForGroup(group: ChartGroupKey): ChartMetricConfig[] {
    const metrics = this.availableChartMetrics.filter(metric => metric.group === group);
    if (!this.chartSortAlertsFirst) return metrics;

    const rank = (metric: ChartMetricConfig) => {
      const status = this.metricStatus(metric);
      return status === 'warning' ? 0 : status === 'ok' ? 1 : 2;
    };

    return [...metrics].sort((a, b) => rank(a) - rank(b));
  }

  openChartDetails(metric: ChartMetricConfig): void {
    this.dialog.open<ChartDetailDialogComponent, ChartDetailDialogData>(
      ChartDetailDialogComponent,
      {
        width: '900px',
        maxWidth: '96vw',
        maxHeight: '92vh',
        data: {
          aquariumId: this.id,
          waterType: this.waterType,
          metric: metric.metric,
          label: metric.label,
          measurements: this.measurements,
          events: this.maintenanceEvents,
          periodDays: this.chartPeriodDays,
          periodLabel: this.chartPeriodLabel,
          target: this.getRange(metric.targetKey),
        },
      },
    );
  }

  private get availableChartMetrics(): ChartMetricConfig[] {
    return this.chartMetrics.filter(metric =>
      this.waterType === 'EAU_DOUCE'
        ? metric.group !== 'marine'
        : metric.group === 'essential' || metric.group === 'marine',
    );
  }

  private metricStatus(metric: ChartMetricConfig): 'ok' | 'warning' | 'unknown' {
    const value = this.latestMetricValue(metric.metric);
    const range = this.getRange(metric.targetKey);
    if (value === null || !range || (range.min == null && range.max == null)) return 'unknown';
    if (range.min != null && value < range.min) return 'warning';
    if (range.max != null && value > range.max) return 'warning';
    return 'ok';
  }

  private latestMetricValue(metric: MetricKey): number | null {
    const latest = this.measurements[0];
    if (!latest) return null;

    if (metric === 'co2') {
      if (latest.ph == null || latest.kh == null) return null;
      const value = 3 * latest.kh * Math.pow(10, 7 - latest.ph);
      return Number.isFinite(value) ? value : null;
    }

    const value = latest[metric as keyof WaterMeasurement];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
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
    if (index !== 2) return;
    if (this.solutionsLoadedOnce) return;

    this.solutionsLoadedOnce = true;
    await this.detectPremiumAndLoadSolutions();
  }

  private async detectPremiumAndLoadSolutions(): Promise<void> {
    this.targetsLoading = true;

    try {
      const me = await this.usersApi.getMe();
      const status = String(me.subscriptionStatus ?? 'none').toLowerCase();
      const plan = String(me.subscriptionPlan ?? 'CLASSIC').toUpperCase();
      this.isPremium =
        me.role === 'ADMIN' ||
        ((plan === 'PREMIUM' || plan === 'PRO') &&
          (status === 'active' || status === 'trialing'));
      this.targets = await this.targetsApi.getForAquarium(this.id);
      this.buildTargetsForm(this.targets);
    } catch (e: any) {
      this.targets = null;
      this.targetsForm = null;
      this.recos = [];

      this.snack.open('Impossible de charger les solutions pour le moment', 'Fermer', {
        duration: 3000,
      });

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
    this.rebuildMeasurementHistory();
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
    this.recosLoading = true;

    try {
      const list = await this.recosApi.listPending(this.id);
      this.recos = Array.isArray(list) ? list : [];
    } catch (e: any) {
      this.snack.open('Impossible de charger les solutions', 'Fermer', {
        duration: 3000,
      });
    } finally {
      this.recosLoading = false;
    }
  }

  async refreshSolutions(): Promise<void> {
    await this.loadTargets();
    await this.loadPendingRecos();
  }

  async analyzeWithAi(question?: string): Promise<void> {
  if (!this.id || this.aiLoading) return;

  const finalQuestion =
    question?.trim() ||
    this.aiChatQuestion?.trim() ||
    'Analyse mes paramètres et donne-moi des conseils concrets pour cet aquarium.';

  if (!finalQuestion) {
    this.aiError = 'Écris une question avant de demander à l’IA.';
    return;
  }

  this.aiLoading = true;
  this.aiError = '';

  this.aiChatMessages.push({
    role: 'user',
    content: finalQuestion,
  });

  this.aiChatQuestion = '';

  try {
    const response = await firstValueFrom(
      this.aiApi.analyzeAquarium(this.id, finalQuestion),
    );

    this.aiAnalysis = response;

    this.aiChatMessages.push({
      role: 'assistant',
      content: response.analysis,
    });

    this.snack.open('Réponse IA générée ✅', 'OK', {
      duration: 2200,
    });
  } catch (e: any) {
    console.error(e);

    this.aiError =
      e?.error?.message ||
      e?.error?.error ||
      "Impossible d'interroger l'IA pour le moment.";

    this.aiChatMessages.push({
      role: 'assistant',
      content: this.aiError,
    });

    this.snack.open(this.aiError, 'Fermer', {
      duration: 3500,
    });
  } finally {
    this.aiLoading = false;
  }
}

onAiChatEnter(event: Event): void {
  const keyboardEvent = event as KeyboardEvent;

  if (keyboardEvent.shiftKey) {
    return;
  }

  keyboardEvent.preventDefault();

  if (!this.aiLoading && this.aiChatQuestion.trim()) {
    void this.analyzeWithAi();
  }
}

clearAiChat(): void {
  this.aiChatMessages = [];
  this.aiError = '';
  this.aiAnalysis = null;
}

onAiPhotoSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) return;

  if (!file.type.startsWith('image/')) {
    this.aiPhotoError = 'Le fichier doit être une image.';
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    this.aiPhotoError = 'Image trop lourde. Maximum 2 Mo.';
    return;
  }

  this.aiPhotoFile = file;
  this.aiPhotoError = '';
  this.aiPhotoAnalysis = null;

  const reader = new FileReader();

  reader.onload = () => {
    this.aiPhotoPreview = String(reader.result || '');
  };

  reader.readAsDataURL(file);
}

async analyzePhotoWithAi(): Promise<void> {
  if (!this.id || this.aiPhotoLoading) return;

  if (!this.aiPhotoFile) {
    this.aiPhotoError = 'Ajoute une photo avant de lancer l’analyse.';
    return;
  }

  this.aiPhotoLoading = true;
  this.aiPhotoError = '';
  this.aiPhotoAnalysis = null;

  try {
    this.aiPhotoAnalysis = await firstValueFrom(
      this.aiApi.analyzeAquariumPhoto(
        this.id,
        this.aiPhotoFile,
        this.aiPhotoProblemType,
        this.aiPhotoQuestion,
      ),
    );

    this.snack.open('Analyse photo IA terminée ✅', 'OK', {
      duration: 2200,
    });
  } catch (e: any) {
    console.error(e);

    this.aiPhotoError =
      e?.error?.message ||
      e?.error?.error ||
      "Impossible de lancer l'analyse photo IA pour le moment.";

    this.snack.open(this.aiPhotoError, 'Fermer', {
      duration: 3500,
    });
  } finally {
    this.aiPhotoLoading = false;
  }
}

  async addAiSuggestedTask(task: AiSuggestedTask): Promise<void> {
    const ref = this.dialog.open(RecommendationScheduleDialogComponent, {
      width: '520px',
      data: {
        title: task.title,
        message: task.reason,
        initialDueAt: task.suggestedDueAt,
      },
      autoFocus: false,
      restoreFocus: false,
    });

    const result = await firstValueFrom(ref.afterClosed());
    if (!result?.dueAt) return;

    try {
      await firstValueFrom(
        this.tasksApi.create({
          aquariumId: this.id,
          type: task.type,
          title: task.title,
          description: task.description,
          dueAt: result.dueAt,
          repeat: null,
          fertilization: null,
        }),
      );
      this.snack.open('Tâche IA ajoutée au planning ✅', 'OK', {
        duration: 2500,
      });
    } catch (e: any) {
      this.snack.open(
        e?.error?.message || "Impossible d'ajouter la tâche au planning",
        'Fermer',
        { duration: 3000 },
      );
    }
  }

  selectSolutionView(view: 'assistant' | 'ai'): void {
    this.solutionView = view;
  }

  async acceptReco(r: Recommendation): Promise<void> {
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
    this.targetsLoading = true;

    try {
      const dto = await this.targetsApi.getForAquarium(this.id);

      this.targets = dto;
      this.buildTargetsForm(dto);
    } catch (e: any) {
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

      if (a) {
        this.form.patchValue(a as any);
        this.protocolAquarium = a;
      }
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

      const updated = await firstValueFrom(this.api.update(this.id, dto));
      this.protocolAquarium = updated;

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
    this.rebuildMeasurementHistory();
  }

  private rebuildMeasurementHistory(): void {
    const units: Partial<Record<MetricKey, string>> = {
      temp: '°C',
      no2: 'mg/L',
      no3: 'mg/L',
      nh3: 'mg/L',
      kh: '°d',
      gh: '°d',
      po4: 'mg/L',
      fe: 'mg/L',
      k: 'mg/L',
      sio2: 'mg/L',
      dkh: '°d',
      salinity: 'ppt',
      ca: 'mg/L',
      mg: 'mg/L',
    };

    this.measurementHistory = this.displayedMeasurements.map(measurement => {
      const metrics = this.availableChartMetrics
        .filter(metric => metric.metric !== 'co2')
        .map(metric => {
          const raw = measurement[metric.metric as keyof WaterMeasurement];
          if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;

          const range = this.getRange(metric.targetKey);
          let status: HistoryMetricView['status'] = 'unknown';
          if (range && (range.min != null || range.max != null)) {
            status =
              (range.min != null && raw < range.min) ||
              (range.max != null && raw > range.max)
                ? 'warning'
                : 'ok';
          }

          return {
            key: metric.metric,
            label: metric.label,
            value: raw,
            unit: units[metric.metric] ?? '',
            status,
          };
        })
        .filter((metric): metric is HistoryMetricView => metric !== null);
      const warnings = metrics.filter(metric => metric.status === 'warning').length;
      const evaluated = metrics.filter(metric => metric.status !== 'unknown').length;
      const unknown = metrics.length - evaluated;

      return {
        measurement,
        metrics,
        evaluated,
        warnings,
        unknown,
        status: warnings > 0 ? 'warning' : evaluated > 0 ? 'ok' : 'unknown',
      };
    });
  }

  historyStatusLabel(view: MeasurementHistoryView): string {
    if (view.status === 'warning') {
      return `${view.warnings} valeur${view.warnings > 1 ? 's' : ''} à vérifier`;
    }
    if (view.status === 'ok') return 'Valeurs évaluées correctes';
    return 'Sans référence';
  }

  formatHistoryValue(value: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
  }

  trackHistory(_: number, view: MeasurementHistoryView): number {
    return view.measurement.id;
  }

  async loadMeasurements(): Promise<void> {
    try {
      const url = `${environment.apiUrl}/aquariums/${this.id}/measurements`;
      const res = await firstValueFrom(this.http.get<WaterMeasurement[]>(url));

      this.measurements = [...(res ?? [])].sort(
        (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
      );

      this.applyLimit();
      this.rebuildMaintenanceImpacts();
    } catch {
      this.snack.open('Erreur lors du chargement des mesures', 'Fermer', {
        duration: 3000,
      });
    }
  }

  async loadMaintenanceEvents(): Promise<void> {
    try {
      const tasks = await firstValueFrom(this.tasksApi.list());
      this.maintenanceEvents = (tasks ?? [])
        .filter(
          (task: Task) =>
            task.status === 'DONE' && Number(task.aquarium?.id) === Number(this.id),
        )
        .map((task: Task) => ({
          id: String(task.id),
          title: task.title,
          description: task.description,
          date: task.dueAt,
          type: task.type,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      this.rebuildMaintenanceImpacts();
    } catch {
      this.maintenanceEvents = [];
      this.maintenanceImpacts = {};
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
