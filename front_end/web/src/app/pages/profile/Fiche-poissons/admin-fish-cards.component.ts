// admin-fish-cards.component.ts
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
  ModerationStatus,
} from '../../../core/fish-cards';
import { AuthService } from '../../../core/auth.service';
import { UserService } from '../../../core/user.service';

type AppRole = 'USER' | 'EDITOR' | 'ADMIN' | 'SUPERADMIN';

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

  tabIndex = 0;

  rows: FishCard[] = [];
  filtered: FishCard[] = [];
  selected: FishCard | null = null;

  search = '';

  // ✅ filtre admin : pending only
  showPendingOnly = false;

  form: FormGroup;

  pendingCreateFile: File | null = null;
  imageBroken = false;

  private role: AppRole = 'USER';

  get isAdmin(): boolean {
    return this.role === 'ADMIN' || this.role === 'SUPERADMIN';
  }

  get isEditor(): boolean {
    return this.role === 'EDITOR';
  }

  private readonly apiOrigin = this.computeApiOrigin(environment.apiUrl);

  constructor(
    private readonly fb: FormBuilder,
    private readonly api: FishCardsApi,
    private readonly auth: AuthService,
    private readonly users: UserService,
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
    this.bootstrap();
  }

  ngOnDestroy(): void {}

  back(): void {
    this.location.back();
  }

  // ✅ bouton admin : toggle pending filter
  togglePendingOnly(): void {
    if (!this.isAdmin) return;
    this.showPendingOnly = !this.showPendingOnly;
    this.applyClientFilter();
    this.cdr.markForCheck();
  }

  // ---------- AUTH ----------
  private ensureAuth$() {
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

  private bootstrap(): void {
    this.loading = true;
    this.cdr.markForCheck();

    this.ensureAuth$()
      .pipe(
        switchMap(() => from(this.users.getMe())),
        take(1),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (me: any) => {
          this.role = String(me?.role ?? 'USER').toUpperCase().trim() as AppRole;

          // Editor: publication verrouillée
          if (this.isEditor) this.form.get('isActive')?.disable({ emitEvent: false });
          else this.form.get('isActive')?.enable({ emitEvent: false });

          // ✅ filtre pending uniquement pour admin
          if (!this.isAdmin) this.showPendingOnly = false;

          this.cdr.markForCheck();
          this.refresh();
        },
        error: (err) => {
          if (String(err?.message || '') === 'NO_TOKEN') return;
          console.error(err);
          this.snack.open('Impossible de récupérer ton profil. Reconnecte-toi.', 'OK', { duration: 4500 });
          this.cdr.markForCheck();
        },
      });
  }

  // ---------- LIST ----------
  refresh(): void {
    this.loading = true;

    this.ensureAuth$()
      .pipe(
        switchMap(() => (this.isAdmin ? this.api.listAdmin(this.search) : this.api.listEditor(this.search))),
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

    // 1) filtre recherche texte
    const base = !q
      ? this.rows
      : this.rows.filter((r) => this.normalize(this.rowToSearchBlob(r)).includes(q));

    // 2) filtre "pending only" (admin)
    if (this.isAdmin && this.showPendingOnly) {
      this.filtered = base.filter((r) => r.status === 'PENDING');
      return;
    }

    this.filtered = base;
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

    if (this.isEditor) this.form.get('isActive')?.disable({ emitEvent: false });
    else this.form.get('isActive')?.enable({ emitEvent: false });

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

    if (this.isEditor) this.form.get('isActive')?.disable({ emitEvent: false });
    else this.form.get('isActive')?.enable({ emitEvent: false });

    this.tabIndex = 1;
    this.cdr.markForCheck();
  }

  // ---------- MODERATION UI (ADMIN ONLY) ----------
  approveSelected(): void {
    if (!this.isAdmin || !this.selected) return;

    this.saving = true;
    this.cdr.markForCheck();

    this.ensureAuth$()
      .pipe(
        switchMap(() => this.api.approve(this.selected!.id)),
        take(1),
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (updated) => {
          this.snack.open(`Fiche approuvée (#${updated.id})`, 'OK', { duration: 2000 });
          this.refresh();
          this.selectRow(updated);
        },
        error: (err) => {
          if (String(err?.message || '') === 'NO_TOKEN') return;
          console.error(err);
          this.snack.open('Erreur approbation', 'OK', { duration: 4000 });
          this.cdr.markForCheck();
        },
      });
  }

  rejectSelected(): void {
    if (!this.isAdmin || !this.selected) return;

    const reason = prompt('Motif de rejet (obligatoire) :');
    if (!reason || !reason.trim()) return;

    this.saving = true;
    this.cdr.markForCheck();

    this.ensureAuth$()
      .pipe(
        switchMap(() => this.api.reject(this.selected!.id, reason.trim())),
        take(1),
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (updated) => {
          this.snack.open(`Fiche rejetée (#${updated.id})`, 'OK', { duration: 2000 });
          this.refresh();
          this.selectRow(updated);
        },
        error: (err) => {
          if (String(err?.message || '') === 'NO_TOKEN') return;
          console.error(err);
          this.snack.open('Erreur rejet', 'OK', { duration: 4000 });
          this.cdr.markForCheck();
        },
      });
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

    this.ensureAuth$()
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
                ? '403 : rôle insuffisant'
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

    if (this.selected) {
      const dto = this.buildUpdatePayload(raw);

      this.saving = true;
      this.cdr.markForCheck();

      this.ensureAuth$()
        .pipe(
          switchMap(() =>
            this.isAdmin ? this.api.updateAdmin(this.selected!.id, dto) : this.api.updateEditor(this.selected!.id, dto),
          ),
          take(1),
          finalize(() => {
            this.saving = false;
            this.cdr.markForCheck();
          }),
        )
        .subscribe({
          next: (updated) => {
            this.snack.open(`Fiche enregistrée (#${updated.id})`, 'OK', { duration: 2200 });
            this.refresh();
            this.selectRow(updated);
          },
          error: (err) => {
            if (String(err?.message || '') === 'NO_TOKEN') return;
            console.error(err);
            this.snack.open(this.prettyError(err, 'Erreur enregistrement'), 'OK', { duration: 4500 });
            this.cdr.markForCheck();
          },
        });

      return;
    }

    const dto = this.buildCreatePayload(raw);

    this.saving = true;
    this.cdr.markForCheck();

    this.ensureAuth$()
      .pipe(
        switchMap(() =>
          this.isAdmin
            ? this.api.createAdminWithImage(dto, this.pendingCreateFile ?? undefined)
            : this.api.createEditorWithImage(dto, this.pendingCreateFile ?? undefined),
        ),
        take(1),
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (created) => {
          const msg = this.isAdmin ? `Poisson créé (#${created.id})` : `Envoyé en validation (#${created.id})`;
          this.snack.open(msg, 'OK', { duration: 2200 });

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

          if (this.isEditor) this.form.get('isActive')?.disable({ emitEvent: false });
          else this.form.get('isActive')?.enable({ emitEvent: false });

          this.cdr.markForCheck();
        },
        error: (err) => {
          if (String(err?.message || '') === 'NO_TOKEN') return;
          console.error(err);
          this.snack.open(this.prettyError(err, 'Erreur création'), 'OK', { duration: 4500 });
          this.cdr.markForCheck();
        },
      });
  }

  deleteSelected(): void {
    if (!this.selected) return;

    const ok = confirm(`Supprimer la fiche #${this.selected.id} ?`);
    if (!ok) return;

    this.saving = true;
    this.cdr.markForCheck();

    this.ensureAuth$()
      .pipe(
        switchMap(() => (this.isAdmin ? this.api.removeAdmin(this.selected!.id) : this.api.removeEditor(this.selected!.id))),
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

  // ---------- helpers ----------
  badgeLabel(status: ModerationStatus | null | undefined): string {
    if (!status) return '—';
    if (status === 'PENDING') return 'EN ATTENTE';
    if (status === 'APPROVED') return 'APPROUVÉ';
    if (status === 'REJECTED') return 'REJETÉ';
    return status;
  }

  private prettyError(err: any, fallback: string): string {
    if (err?.status === 401) return '401 : pas connecté';
    if (err?.status === 403) return '403 : rôle insuffisant';
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
      'imageUrl',
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
      r.status,
      r.rejectReason,
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
