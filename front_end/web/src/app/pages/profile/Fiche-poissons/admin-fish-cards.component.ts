import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';

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

import { finalize, from, switchMap, take } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  FishCardsApi,
  FishCard,
  WaterType,
  Temperament,
  Activity,
  Difficulty,
  CreateFishCardDto,
  UpdateFishCardDto,
} from '../../../core/fish-cards';
import { AuthService } from '../../../core/auth.service';

type DuplicatePayload = {
  code?: string;
  message?: string;
  existingId?: number;
  existingCommonName?: string;
  waterType?: WaterType;
};

@Component({
  selector: 'app-admin-fish-cards',
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
  templateUrl: './admin-fish-cards.component.html',
  styleUrls: ['./admin-fish-cards.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminFishCardsComponent implements OnInit, OnDestroy {
  readonly waterTypes: WaterType[] = ['EAU_DOUCE', 'EAU_DE_MER', 'SAUMATRE'];
  readonly temperaments: Temperament[] = ['PACIFIQUE', 'SEMI_AGRESSIF', 'AGRESSIF'];
  readonly activities: Activity[] = ['DIURNE', 'NOCTURNE', 'CREPUSCULAIRE'];
  readonly difficulties: Difficulty[] = ['FACILE', 'MOYEN', 'DIFFICILE'];

  loading = false;
  saving = false;
  uploading = false;

  tabIndex = 0; // 0 = Liste / 1 = Création/édition

  rows: FishCard[] = [];
  filtered: FishCard[] = [];
  selected: FishCard | null = null;

  search = '';

  form: FormGroup;

  // Image
  pendingCreateFile: File | null = null;
  imageBroken = false;

  private readonly apiOrigin = this.computeApiOrigin(environment.apiUrl);

  constructor(
    private readonly fb: FormBuilder,
    private readonly api: FishCardsApi,
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

      activity: [null as Activity | null],
      temperament: [null as Temperament | null],
      difficulty: [null as Difficulty | null],

      minVolumeL: [null as number | null],
      minGroupSize: [null as number | null],
      maxSizeCm: [null as number | null],
      lifespanYears: [null as number | null],

      zone: [''],
      diet: [''],
      compatibility: [''],

      tempMin: [null as number | null],
      tempMax: [null as number | null],
      phMin: [null as number | null],
      phMax: [null as number | null],
      ghMin: [null as number | null],
      ghMax: [null as number | null],
      khMin: [null as number | null],
      khMax: [null as number | null],

      behavior: [''],
      breeding: [''],
      breedingTips: [''],
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

  // =======================
  // AUTH SAFE-GUARD (NO 401)
  // =======================
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

  // ---------- LIST ----------
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
          this.snack.open('Erreur chargement des fiches poissons', 'OK', { duration: 3500 });
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

  selectRow(r: FishCard): void {
    this.selected = r;
    this.pendingCreateFile = null;
    this.imageBroken = false;

    this.form.patchValue({
      commonName: r.commonName ?? '',
      scientificName: r.scientificName ?? '',
      family: r.family ?? '',
      origin: r.origin ?? '',
      waterType: r.waterType ?? 'EAU_DOUCE',

      activity: r.activity ?? null,
      temperament: r.temperament ?? null,
      difficulty: r.difficulty ?? null,

      minVolumeL: r.minVolumeL ?? null,
      minGroupSize: r.minGroupSize ?? null,
      maxSizeCm: r.maxSizeCm ?? null,
      lifespanYears: r.lifespanYears ?? null,

      zone: r.zone ?? '',
      diet: r.diet ?? '',
      compatibility: r.compatibility ?? '',

      tempMin: r.tempMin ?? null,
      tempMax: r.tempMax ?? null,
      phMin: r.phMin ?? null,
      phMax: r.phMax ?? null,
      ghMin: r.ghMin ?? null,
      ghMax: r.ghMax ?? null,
      khMin: r.khMin ?? null,
      khMax: r.khMax ?? null,

      behavior: r.behavior ?? '',
      breeding: r.breeding ?? '',
      breedingTips: r.breedingTips ?? '',
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

      activity: null,
      temperament: null,
      difficulty: null,

      minVolumeL: null,
      minGroupSize: null,
      maxSizeCm: null,
      lifespanYears: null,

      zone: '',
      diet: '',
      compatibility: '',

      tempMin: null,
      tempMax: null,
      phMin: null,
      phMax: null,
      ghMin: null,
      ghMax: null,
      khMin: null,
      khMax: null,

      behavior: '',
      breeding: '',
      breedingTips: '',
      notes: '',

      imageUrl: '',
      isActive: true,
    });

    this.tabIndex = 1;
    this.cdr.markForCheck();
  }

  // ---------- IMAGE ----------
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

  // ---------- SUBMIT ----------
  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();

    // EDIT
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
            this.snack.open(`Poisson modifié (#${updated.id})`, 'OK', { duration: 2200 });
            this.refresh();
            this.selectRow(updated);
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

            this.snack.open(this.prettyError(err, 'Erreur modification poisson'), 'OK', { duration: 4500 });
            this.cdr.markForCheck();
          },
        });

      return;
    }

    // CREATE
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
          this.snack.open(`Poisson créé (#${created.id})`, 'OK', { duration: 2200 });
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

            activity: null,
            temperament: null,
            difficulty: null,

            minVolumeL: null,
            minGroupSize: null,
            maxSizeCm: null,
            lifespanYears: null,

            zone: '',
            diet: '',
            compatibility: '',

            tempMin: null,
            tempMax: null,
            phMin: null,
            phMax: null,
            ghMin: null,
            ghMax: null,
            khMin: null,
            khMax: null,

            behavior: '',
            breeding: '',
            breedingTips: '',
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

          this.snack.open(this.prettyError(err, 'Erreur création poisson'), 'OK', { duration: 4500 });
          this.cdr.markForCheck();
        },
      });
  }

  deleteSelected(): void {
    if (!this.selected) return;

    const ok = confirm(`Supprimer la fiche poisson #${this.selected.id} ?`);
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

  // ---------- DUPLICATE UI ----------
  private extractDuplicate(err: any): DuplicatePayload | null {
    if (err?.status !== 409) return null;

    const payload: DuplicatePayload = err?.error ?? {};
    if (payload?.code && payload.code !== 'DUPLICATE_FISH_CARD') {
      return { message: 'Cette fiche poisson existe déjà.' };
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
          : 'Cette fiche poisson existe déjà.';

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

  // ---------- helpers ----------
  private prettyError(err: any, fallback: string): string {
    if (err?.status === 401) return '401 : pas connecté';
    if (err?.status === 403) return '403 : pas ADMIN';
    if (err?.status === 400) return '400 : données invalides';
    if (err?.status === 409) return 'Doublon : déjà en base';
    return fallback;
  }

  private buildCreatePayload(raw: any): CreateFishCardDto {
    const dto: any = {
      commonName: String(raw.commonName ?? '').trim(),
      waterType: raw.waterType,
      isActive: raw.isActive ?? true,
    };

    const keys = [
      'scientificName', 'family', 'origin',
      'activity', 'temperament', 'difficulty',
      'minVolumeL', 'minGroupSize', 'maxSizeCm', 'lifespanYears',
      'zone', 'diet', 'compatibility',
      'tempMin', 'tempMax', 'phMin', 'phMax', 'ghMin', 'ghMax', 'khMin', 'khMax',
      'behavior', 'breeding', 'breedingTips', 'notes',
    ];

    for (const k of keys) {
      const v = raw[k];
      if (v === undefined || v === null || v === '') continue;
      dto[k] = v;
    }

    return dto as CreateFishCardDto;
  }

  private buildUpdatePayload(raw: any): UpdateFishCardDto {
    const dto: any = {
      commonName: String(raw.commonName ?? '').trim(),
      waterType: raw.waterType,
      imageUrl: raw.imageUrl ? String(raw.imageUrl).trim() : null,
      isActive: raw.isActive ?? true,
    };

    const keys = [
      'scientificName', 'family', 'origin',
      'activity', 'temperament', 'difficulty',
      'minVolumeL', 'minGroupSize', 'maxSizeCm', 'lifespanYears',
      'zone', 'diet', 'compatibility',
      'tempMin', 'tempMax', 'phMin', 'phMax', 'ghMin', 'ghMax', 'khMin', 'khMax',
      'behavior', 'breeding', 'breedingTips', 'notes',
    ];

    for (const k of keys) {
      const v = raw[k];
      if (v === undefined) continue;
      dto[k] = v === '' ? null : v;
    }

    return dto as UpdateFishCardDto;
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

  private rowToSearchBlob(r: FishCard): string {
    return [
      r.commonName,
      r.scientificName,
      r.family,
      r.origin,
      r.waterType,
      r.activity,
      r.temperament,
      r.difficulty,
      r.minVolumeL,
      r.minGroupSize,
      r.maxSizeCm,
      r.lifespanYears,
      r.zone,
      r.diet,
      r.compatibility,
      r.behavior,
      r.breeding,
      r.breedingTips,
      r.notes,
    ]
      .filter((x) => x !== undefined && x !== null && String(x).trim() !== '')
      .join(' | ');
  }

  private toTime(dateLike: any): number {
    const t = new Date(dateLike ?? 0).getTime();
    return Number.isFinite(t) ? t : 0;
  }
}
