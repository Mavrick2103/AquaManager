import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatListModule } from '@angular/material/list';

import { RouterModule } from '@angular/router';

import { finalize, from, switchMap, take } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  PlantCardsApi,
  PlantCard,
  WaterType,
  PlantCategory,
  PlantPlacement,
  GrowthRate,
  Light,
  Co2,
  Difficulty,
  Propagation,
  CreatePlantCardDto,
  UpdatePlantCardDto,
} from '../../../core/plant-cards';
import { AuthService } from '../../../core/auth.service';

type DuplicatePayload = {
  code?: string;
  message?: string;
  existingId?: number;
  existingCommonName?: string;
  waterType?: WaterType;
};

@Component({
  selector: 'app-admin-plant-cards',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,

    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatTabsModule,
    MatIconModule,
    MatSnackBarModule,
    MatDividerModule,
    MatSlideToggleModule,
    MatListModule,
  ],
  templateUrl: './admin-plant-cards.component.html',
  styleUrls: ['./admin-plant-cards.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPlantCardsComponent implements OnInit, OnDestroy {
  readonly waterTypes: WaterType[] = ['EAU_DOUCE', 'EAU_DE_MER', 'SAUMATRE'];

  readonly categories: PlantCategory[] = [
    'TIGE', 'ROSETTE', 'RHIZOME', 'MOUSSE', 'GAZONNANTE', 'BULBE', 'FLOTTANTE', 'EPIPHYTE',
  ];
  readonly placements: PlantPlacement[] = [
    'AVANT_PLAN', 'MILIEU', 'ARRIERE_PLAN', 'SUR_SUPPORT', 'SURFACE',
  ];
  readonly growthRates: GrowthRate[] = ['LENTE', 'MOYENNE', 'RAPIDE'];
  readonly lights: Light[] = ['FAIBLE', 'MOYEN', 'FORT'];
  readonly co2s: Co2[] = ['AUCUN', 'RECOMMANDE', 'OBLIGATOIRE'];
  readonly difficulties: Difficulty[] = ['FACILE', 'MOYEN', 'DIFFICILE'];
  readonly propagations: Propagation[] = [
    'BOUTURAGE', 'STOLON', 'RHIZOME', 'DIVISION', 'SPORES', 'GRAINES', 'AUCUNE',
  ];

  loading = false;
  saving = false;
  uploading = false;

  tabIndex = 0; // 0 = Liste / 1 = Création/édition

  rows: PlantCard[] = [];
  filtered: PlantCard[] = [];
  selected: PlantCard | null = null;

  search = '';

  form: FormGroup;

  // Image
  pendingCreateFile: File | null = null;
  imageBroken = false;

  private readonly apiOrigin = this.computeApiOrigin(environment.apiUrl);

  constructor(
    private readonly fb: FormBuilder,
    private readonly api: PlantCardsApi,
    private readonly auth: AuthService,
    private readonly snack: MatSnackBar,
    private readonly location: Location,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.form = this.fb.group({
      commonName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      scientificName: [''],
      family: [''],
      origin: [''],
      waterType: ['EAU_DOUCE' as WaterType, Validators.required],

      category: [null as PlantCategory | null],
      placement: [null as PlantPlacement | null],
      growthRate: [null as GrowthRate | null],
      maxHeightCm: [null as number | null],
      propagation: [null as Propagation | null],

      light: [null as Light | null],
      co2: [null as Co2 | null],
      difficulty: [null as Difficulty | null],

      tempMin: [null as number | null],
      tempMax: [null as number | null],
      phMin: [null as number | null],
      phMax: [null as number | null],
      ghMin: [null as number | null],
      ghMax: [null as number | null],
      khMin: [null as number | null],
      khMax: [null as number | null],

      needsFe: [null as boolean | null],
      needsNo3: [null as boolean | null],
      needsPo4: [null as boolean | null],
      needsK: [null as boolean | null],
      substrateRequired: [null as boolean | null],

      trimming: [''],
      compatibility: [''],
      notes: [''],

      imageUrl: [''],
      isActive: [true],
    });
  }

  ngOnInit(): void {
    this.refresh();
  }

  ngOnDestroy(): void {}

  back(): void {
    this.location.back();
  }

  private ensureAdminAuth$() {
    if (this.auth.isAuthenticated()) return from(Promise.resolve(true));

    return from(this.auth.refreshAccessToken()).pipe(
      switchMap((tk) => {
        if (!tk) {
          this.snack.open('Session expirée : reconnecte-toi.', 'OK', { duration: 4500 });
          throw new Error('NO_TOKEN');
        }
        return from(Promise.resolve(true));
      }),
    );
  }

  refresh(): void {
    this.loading = true;

    this.ensureAdminAuth$()
      .pipe(
        switchMap(() => this.api.listAdmin(this.search)),
        take(1),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (rows) => {
          const safe = Array.isArray(rows) ? rows : [];
          safe.sort((a, b) => this.toTime(b.createdAt) - this.toTime(a.createdAt));

          this.rows = safe;
          this.applyClientFilter();
          this.cdr.markForCheck();
        },
        error: (err) => {
          if (String(err?.message || '') === 'NO_TOKEN') return;

          console.error(err);
          this.snack.open('Erreur chargement des fiches plantes', 'OK', { duration: 3500 });
          this.cdr.markForCheck();
        },
      });
  }

  onSearchChange(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value ?? '';
    this.search = v;
    this.applyClientFilter();
    this.cdr.markForCheck();
  }

  private applyClientFilter(): void {
    const q = this.normalize(this.search);
    if (!q) {
      this.filtered = this.rows;
      return;
    }
    this.filtered = this.rows.filter((r) => this.normalize(this.rowToSearchBlob(r)).includes(q));
  }

  selectRow(r: PlantCard): void {
    this.selected = r;
    this.pendingCreateFile = null;
    this.imageBroken = false;

    this.form.patchValue({
      commonName: r.commonName ?? '',
      scientificName: r.scientificName ?? '',
      family: r.family ?? '',
      origin: r.origin ?? '',
      waterType: r.waterType ?? 'EAU_DOUCE',

      category: r.category ?? null,
      placement: r.placement ?? null,
      growthRate: r.growthRate ?? null,
      maxHeightCm: r.maxHeightCm ?? null,
      propagation: r.propagation ?? null,

      light: r.light ?? null,
      co2: r.co2 ?? null,
      difficulty: r.difficulty ?? null,

      tempMin: r.tempMin ?? null,
      tempMax: r.tempMax ?? null,
      phMin: r.phMin ?? null,
      phMax: r.phMax ?? null,
      ghMin: r.ghMin ?? null,
      ghMax: r.ghMax ?? null,
      khMin: r.khMin ?? null,
      khMax: r.khMax ?? null,

      needsFe: r.needsFe ?? null,
      needsNo3: r.needsNo3 ?? null,
      needsPo4: r.needsPo4 ?? null,
      needsK: r.needsK ?? null,
      substrateRequired: r.substrateRequired ?? null,

      trimming: r.trimming ?? '',
      compatibility: r.compatibility ?? '',
      notes: r.notes ?? '',

      imageUrl: r.imageUrl ?? '',
      isActive: r.isActive ?? true,
    });

    this.tabIndex = 1;
    this.cdr.markForCheck();
  }

  newCard(): void {
    this.selected = null;
    this.pendingCreateFile = null;
    this.imageBroken = false;

    this.form.reset({
      commonName: '',
      scientificName: '',
      family: '',
      origin: '',
      waterType: 'EAU_DOUCE',

      category: null,
      placement: null,
      growthRate: null,
      maxHeightCm: null,
      propagation: null,

      light: null,
      co2: null,
      difficulty: null,

      tempMin: null,
      tempMax: null,
      phMin: null,
      phMax: null,
      ghMin: null,
      ghMax: null,
      khMin: null,
      khMax: null,

      needsFe: null,
      needsNo3: null,
      needsPo4: null,
      needsK: null,
      substrateRequired: null,

      trimming: '',
      compatibility: '',
      notes: '',

      imageUrl: '',
      isActive: true,
    });

    this.tabIndex = 1;
    this.cdr.markForCheck();
  }

  removeImage(): void {
    if (!this.selected) {
      this.pendingCreateFile = null;
      this.form.patchValue({ imageUrl: '' });
      this.imageBroken = false;
      this.snack.open('Image retirée', 'OK', { duration: 1500 });
      this.cdr.markForCheck();
      return;
    }

    this.form.patchValue({ imageUrl: null });
    this.imageBroken = false;

    this.snack.open('Image retirée (pense à enregistrer)', 'OK', { duration: 2000 });
    this.cdr.markForCheck();
  }

  pickImage(input: HTMLInputElement): void {
    input.click();
  }

  onFileSelectedCreate(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    input.value = '';
    this.pendingCreateFile = file;
    this.imageBroken = false;

    this.snack.open('Image prête (envoyée à la création)', 'OK', { duration: 1600 });
    this.cdr.markForCheck();
  }

  onFileSelectedEdit(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    input.value = '';

    this.uploading = true;
    this.imageBroken = false;
    this.cdr.markForCheck();

    this.ensureAdminAuth$()
      .pipe(
        switchMap(() => this.api.uploadImage(file)),
        take(1),
        finalize(() => {
          this.uploading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: ({ url }) => {
          this.form.patchValue({ imageUrl: url });
          this.snack.open('Image importée', 'OK', { duration: 1500 });
          this.cdr.markForCheck();
        },
        error: (err) => {
          if (String(err?.message || '') === 'NO_TOKEN') return;

          console.error(err);
          const msg =
            err?.status === 401
              ? '401 : pas connecté'
              : err?.status === 403
                ? '403 : pas ADMIN'
                : err?.status === 400
                  ? 'Image invalide (type/taille)'
                  : 'Erreur import image';
          this.snack.open(msg, 'OK', { duration: 4500 });
          this.cdr.markForCheck();
        },
      });
  }

  onImgError(): void {
    this.imageBroken = true;
    this.cdr.markForCheck();
  }

  imageSrc(raw: unknown): string | null {
    const v = String(raw ?? '').trim();
    if (!v) return null;

    if (/^https?:\/\//i.test(v) || v.startsWith('data:')) return v;

    const normalized = v.startsWith('/') ? v : `/${v}`;
    if (normalized.startsWith('/uploads/')) return `${this.apiOrigin}${normalized}`;

    return v;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();

    if (this.selected) {
      const dto = this.buildUpdatePayload(raw);
      this.saving = true;
      this.cdr.markForCheck();

      this.ensureAdminAuth$()
        .pipe(
          switchMap(() => this.api.update(this.selected!.id, dto)),
          take(1),
          finalize(() => {
            this.saving = false;
            this.cdr.markForCheck();
          }),
        )
        .subscribe({
          next: (updated) => {
            this.snack.open(`Plante modifiée (#${updated.id})`, 'OK', { duration: 2200 });
            this.refresh();
            this.selectRow(updated);
          },
          error: (err) => {
            if (String(err?.message || '') === 'NO_TOKEN') return;

            console.error(err);
            this.snack.open(this.prettyError(err, 'Erreur modification plante'), 'OK', { duration: 4500 });
            this.cdr.markForCheck();
          },
        });

      return;
    }

    const dto = this.buildCreatePayload(raw);
    this.saving = true;
    this.cdr.markForCheck();

    this.ensureAdminAuth$()
      .pipe(
        switchMap(() => this.api.createWithImage(dto, this.pendingCreateFile ?? undefined)),
        take(1),
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (created) => {
          this.snack.open(`Plante créée (#${created.id})`, 'OK', { duration: 2200 });

          this.pendingCreateFile = null;
          this.tabIndex = 0;
          this.refresh();

          this.selected = null;
          this.form.reset({
            commonName: '',
            scientificName: '',
            family: '',
            origin: '',
            waterType: 'EAU_DOUCE',

            category: null,
            placement: null,
            growthRate: null,
            maxHeightCm: null,
            propagation: null,

            light: null,
            co2: null,
            difficulty: null,

            tempMin: null,
            tempMax: null,
            phMin: null,
            phMax: null,
            ghMin: null,
            ghMax: null,
            khMin: null,
            khMax: null,

            needsFe: null,
            needsNo3: null,
            needsPo4: null,
            needsK: null,
            substrateRequired: null,

            trimming: '',
            compatibility: '',
            notes: '',

            imageUrl: '',
            isActive: true,
          });

          this.cdr.markForCheck();
        },
        error: (err) => {
          if (String(err?.message || '') === 'NO_TOKEN') return;

          console.error(err);

          const dup = this.extractDuplicate(err);
          if (dup) {
            this.showDuplicateSnack(dup);
            this.cdr.markForCheck();
            return;
          }

          this.snack.open(this.prettyError(err, 'Erreur création plante'), 'OK', { duration: 4500 });
          this.cdr.markForCheck();
        },
      });
  }

  deleteSelected(): void {
    if (!this.selected) return;

    const ok = confirm(`Supprimer la fiche plante #${this.selected.id} ?`);
    if (!ok) return;

    this.saving = true;
    this.cdr.markForCheck();

    this.ensureAdminAuth$()
      .pipe(
        switchMap(() => this.api.remove(this.selected!.id)),
        take(1),
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.snack.open('Fiche supprimée', 'OK', { duration: 1800 });
          this.selected = null;
          this.tabIndex = 0;
          this.refresh();
          this.cdr.markForCheck();
        },
        error: (err) => {
          if (String(err?.message || '') === 'NO_TOKEN') return;

          console.error(err);
          this.snack.open(this.prettyError(err, 'Erreur suppression'), 'OK', { duration: 4500 });
          this.cdr.markForCheck();
        },
      });
  }

  private extractDuplicate(err: any): DuplicatePayload | null {
    if (err?.status !== 409) return null;

    const payload: DuplicatePayload = err?.error ?? {};
    if (payload?.code && payload.code !== 'DUPLICATE_PLANT_CARD') {
      return { message: 'Cette fiche plante existe déjà.' };
    }
    return payload;
  }

  private showDuplicateSnack(dup: DuplicatePayload): void {
    const existingId = dup.existingId;
    const existingName = dup.existingCommonName;

    const text =
      existingId && existingName
        ? `Déjà en base : “${existingName}” (ID #${existingId}).`
        : existingId
          ? `Déjà en base (ID #${existingId}).`
          : 'Cette fiche plante existe déjà.';

    const ref = this.snack.open(text, existingId ? 'Ouvrir' : 'OK', { duration: 7000 });

    if (!existingId) return;

    ref.onAction().pipe(take(1)).subscribe(() => {
      const local = this.rows.find((r) => r.id === existingId);
      if (local) {
        this.selectRow(local);
        return;
      }

      this.refresh();
      setTimeout(() => {
        const after = this.rows.find((r) => r.id === existingId);
        if (after) this.selectRow(after);
      }, 250);
    });
  }

  private prettyError(err: any, fallback: string): string {
    if (err?.status === 401) return '401 : pas connecté';
    if (err?.status === 403) return '403 : pas ADMIN';
    if (err?.status === 400) return '400 : données invalides';
    if (err?.status === 409) return 'Doublon : déjà en base';
    return fallback;
  }

  private buildCreatePayload(raw: any): CreatePlantCardDto {
    const dto: any = {
      commonName: String(raw.commonName ?? '').trim(),
      waterType: raw.waterType,
      isActive: raw.isActive ?? true,
    };

    const keys = [
      'scientificName', 'family', 'origin',
      'category', 'placement', 'growthRate', 'maxHeightCm', 'propagation',
      'light', 'co2', 'difficulty',
      'tempMin', 'tempMax', 'phMin', 'phMax', 'ghMin', 'ghMax', 'khMin', 'khMax',
      'needsFe', 'needsNo3', 'needsPo4', 'needsK', 'substrateRequired',
      'trimming', 'compatibility', 'notes',
    ];

    for (const k of keys) {
      const v = raw[k];
      if (v === undefined || v === null || v === '') continue;
      dto[k] = v;
    }

    return dto as CreatePlantCardDto;
  }

  private buildUpdatePayload(raw: any): UpdatePlantCardDto {
    const dto: any = {
      commonName: String(raw.commonName ?? '').trim(),
      waterType: raw.waterType,
      imageUrl: raw.imageUrl ? String(raw.imageUrl).trim() : null,
      isActive: raw.isActive ?? true,
    };

    const keys = [
      'scientificName', 'family', 'origin',
      'category', 'placement', 'growthRate', 'maxHeightCm', 'propagation',
      'light', 'co2', 'difficulty',
      'tempMin', 'tempMax', 'phMin', 'phMax', 'ghMin', 'ghMax', 'khMin', 'khMax',
      'needsFe', 'needsNo3', 'needsPo4', 'needsK', 'substrateRequired',
      'trimming', 'compatibility', 'notes',
    ];

    for (const k of keys) {
      const v = raw[k];
      if (v === undefined) continue;
      dto[k] = v === '' ? null : v;
    }

    return dto as UpdatePlantCardDto;
  }

  private computeApiOrigin(apiUrl: string): string {
    return String(apiUrl || '').replace(/\/api\/?$/, '');
  }

  private normalize(v: unknown): string {
    return String(v ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  private rowToSearchBlob(r: PlantCard): string {
    return [
      r.commonName,
      r.scientificName,
      r.family,
      r.origin,
      r.waterType,
      r.category,
      r.placement,
      r.growthRate,
      r.propagation,
      r.light,
      r.co2,
      r.difficulty,
      r.compatibility,
      r.notes,
    ]
      .filter(Boolean)
      .join(' | ');
  }

  private toTime(dateLike: any): number {
    const t = new Date(dateLike ?? 0).getTime();
    return Number.isFinite(t) ? t : 0;
  }
}
