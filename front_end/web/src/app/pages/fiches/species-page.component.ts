import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnInit,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, finalize, startWith, take } from 'rxjs';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { environment } from '../../../environments/environment';

type WaterType = 'EAU_DOUCE' | 'EAU_DE_MER' | 'SAUMATRE';

export type FishCardPublicDto = {
  id: number;
  commonName: string;
  scientificName: string | null;
  family: string | null;
  origin: string | null;
  waterType: WaterType;
  imageUrl: string | null;
  minVolumeL: number | null;
  tempMin: number | null;
  tempMax: number | null;
  phMin: number | null;
  phMax: number | null;
  difficulty?: 'FACILE' | 'MOYEN' | 'DIFFICILE' | null;
  temperament?: 'PACIFIQUE' | 'SEMI_AGRESSIF' | 'AGRESSIF' | null;
};

export type PlantCardPublicDto = {
  id: number;
  commonName: string;
  scientificName: string | null;
  family: string | null;
  origin: string | null;
  waterType: WaterType;
  imageUrl: string | null;
  category?: string | null;
  placement?: string | null;
  light?: string | null;
  co2?: string | null;
  difficulty?: 'FACILE' | 'MOYEN' | 'DIFFICILE' | null;
  maxHeightCm?: number | null;
  tempMin: number | null;
  tempMax: number | null;
  phMin: number | null;
  phMax: number | null;
};

type Mode = 'FISH' | 'PLANT';

@Component({
  selector: 'app-species-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,

    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './species-page.component.html',
  styleUrls: ['./species-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpeciesPageComponent implements OnInit {
  loading = false;

  modeCtrl = new FormControl<Mode>('FISH', { nonNullable: true });
  qCtrl = new FormControl<string>('', { nonNullable: true });
  waterCtrl = new FormControl<WaterType | null>(null);

  fishItems: FishCardPublicDto[] = [];
  plantItems: PlantCardPublicDto[] = [];

  private readonly apiOrigin = this.computeApiOrigin(environment.apiUrl);

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
    private readonly location: Location,
  ) {}

  ngOnInit(): void {
    this.setupSearch();
    this.refresh();
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }
    window.location.href = '/';
  }

  get isFish(): boolean {
    return this.modeCtrl.value === 'FISH';
  }

  get itemsCount(): number {
    return this.isFish ? this.fishItems.length : this.plantItems.length;
  }

  refresh(): void {
    this.loading = true;

    const q = this.qCtrl.value?.trim() || undefined;
    const waterType = this.waterCtrl.value || undefined;

    const paramsBase: Record<string, string> = {};
    if (q) paramsBase['search'] = q;
    // ton back ne filtre pas waterType dans findAllPublic → on fait le filtre côté front (simple)
    // on garde le param côté front uniquement (pour l’affichage), pas besoin de l'envoyer.

    if (this.isFish) {
      this.http
        .get<FishCardPublicDto[]>(`${environment.apiUrl}/fish-cards`, {
          params: new HttpParams({ fromObject: paramsBase }),
        })
        .pipe(
          take(1),
          finalize(() => {
            this.loading = false;
            this.cdr.markForCheck();
          }),
        )
        .subscribe({
          next: (rows) => {
            const safe = Array.isArray(rows) ? rows : [];
            this.fishItems = waterType ? safe.filter((x) => x.waterType === waterType) : safe;
            this.cdr.markForCheck();
          },
          error: (err) => {
            console.error(err);
            this.fishItems = [];
            this.cdr.markForCheck();
          },
        });
      return;
    }

    this.http
      .get<PlantCardPublicDto[]>(`${environment.apiUrl}/plant-cards`, {
        params: new HttpParams({ fromObject: paramsBase }),
      })
      .pipe(
        take(1),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (rows) => {
          const safe = Array.isArray(rows) ? rows : [];
          this.plantItems = waterType ? safe.filter((x) => x.waterType === waterType) : safe;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error(err);
          this.plantItems = [];
          this.cdr.markForCheck();
        },
      });
  }

  clear(): void {
    this.qCtrl.setValue('');
    this.waterCtrl.setValue(null);
    this.refresh();
  }

  coverSrc(raw: unknown): string | null {
    const v = String(raw ?? '').trim();
    if (!v) return null;

    if (/^https?:\/\//i.test(v) || v.startsWith('data:')) return v;

    const normalized = v.startsWith('/') ? v : `/${v}`;
    if (normalized.startsWith('/uploads/')) return `${this.apiOrigin}${normalized}`;
    return v;
  }

  fishLink(id: number) {
    return ['/species/fish', id];
  }

  plantLink(id: number) {
    return ['/species/plant', id];
  }

  trackById = (_: number, it: { id: number }) => it.id;

  formatRange(min: number | null | undefined, max: number | null | undefined, unit: string): string | null {
    const a = Number(min);
    const b = Number(max);
    const hasA = Number.isFinite(a);
    const hasB = Number.isFinite(b);
    if (!hasA && !hasB) return null;
    if (hasA && hasB) return `${a}–${b}${unit}`;
    return `${hasA ? a : b}${unit}`;
  }

  labelWaterType(v: WaterType): string {
    switch (v) {
      case 'EAU_DOUCE': return 'Eau douce';
      case 'EAU_DE_MER': return 'Eau de mer';
      case 'SAUMATRE': return 'Saumâtre';
    }
  }

  private setupSearch(): void {
    this.qCtrl.valueChanges
      .pipe(startWith(this.qCtrl.value), debounceTime(250), distinctUntilChanged())
      .subscribe(() => this.refresh());

    this.modeCtrl.valueChanges
      .pipe(distinctUntilChanged())
      .subscribe(() => {
        // On garde le même search, on recharge juste selon le mode
        this.refresh();
      });

    this.waterCtrl.valueChanges
      .pipe(distinctUntilChanged())
      .subscribe(() => this.refresh());
  }

  private computeApiOrigin(apiUrl: string): string {
    return String(apiUrl || '').replace(/\/api\/?$/, '');
  }
}
