import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnInit,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { finalize, take } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';

import { environment } from '../../../../environments/environment';
import { SeoService } from '../../../core/seo.service';

type WaterType = 'EAU_DOUCE' | 'EAU_DE_MER' | 'SAUMATRE';
type Temperament = 'PACIFIQUE' | 'SEMI_AGRESSIF' | 'AGRESSIF';
type Activity = 'DIURNE' | 'NOCTURNE' | 'CREPUSCULAIRE';
type Difficulty = 'FACILE' | 'MOYEN' | 'DIFFICILE';

export type FishCardPublicDto = {
  id: number;
  slug: string;

  commonName: string;
  scientificName: string | null;
  family: string | null;
  origin: string | null;
  waterType: WaterType;

  tempMin: number | null;
  tempMax: number | null;
  phMin: number | null;
  phMax: number | null;
  ghMin: number | null;
  ghMax: number | null;
  khMin: number | null;
  khMax: number | null;

  minVolumeL: number | null;
  minGroupSize: number | null;
  maxSizeCm: number | null;
  lifespanYears: number | null;

  activity: Activity | null;
  temperament: Temperament | null;
  zone: string | null;
  diet: string | null;
  compatibility: string | null;
  difficulty: Difficulty | null;

  behavior: string | null;
  breeding: string | null;
  breedingTips: string | null;
  notes: string | null;

  imageUrl: string | null;
};

@Component({
  selector: 'app-fish-card-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatChipsModule,
  ],
  templateUrl: './fish-card-detail-page.component.html',
  styleUrls: ['./fish-card-detail-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FishCardDetailPageComponent implements OnInit {
  loading = false;
  notFound = false;

  item: FishCardPublicDto | null = null;

  private readonly apiOrigin = this.computeApiOrigin(environment.apiUrl);

  constructor(
    private readonly http: HttpClient,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
    private readonly location: Location,
    private readonly seo: SeoService,
  ) {}

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');

    if (!slug) {
      this.notFound = true;
      this.seo.markNotFound();
      return;
    }

    this.fetch(slug);
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }

    window.location.href = '/poissons';
  }

  refresh(): void {
    const slug = this.route.snapshot.paramMap.get('slug');

    if (!slug) return;

    this.fetch(slug);
  }

  coverSrc(raw: unknown): string | null {
    const v = String(raw ?? '').trim();
    if (!v) return null;

    if (/^https?:\/\//i.test(v) || v.startsWith('data:')) return v;

    const normalized = v.startsWith('/') ? v : `/${v}`;
    if (normalized.startsWith('/uploads/')) return `${this.apiOrigin}${normalized}`;

    return v;
  }

  formatRange(
    min: number | string | null | undefined,
    max: number | string | null | undefined,
    unit: string,
  ): string | null {
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
      case 'EAU_DOUCE':
        return 'Eau douce';
      case 'EAU_DE_MER':
        return 'Eau de mer';
      case 'SAUMATRE':
        return 'Saumâtre';
    }
  }

  labelActivity(v: Activity | null): string | null {
    if (!v) return null;

    switch (v) {
      case 'DIURNE':
        return 'Diurne';
      case 'NOCTURNE':
        return 'Nocturne';
      case 'CREPUSCULAIRE':
        return 'Crépusculaire';
    }
  }

  labelTemperament(v: Temperament | null): string | null {
    if (!v) return null;

    switch (v) {
      case 'PACIFIQUE':
        return 'Pacifique';
      case 'SEMI_AGRESSIF':
        return 'Semi-agressif';
      case 'AGRESSIF':
        return 'Agressif';
    }
  }

  labelDifficulty(v: Difficulty | null): string | null {
    if (!v) return null;

    switch (v) {
      case 'FACILE':
        return 'Facile';
      case 'MOYEN':
        return 'Moyen';
      case 'DIFFICILE':
        return 'Difficile';
    }
  }

  private fetch(slug: string): void {
    this.loading = true;
    this.notFound = false;
    this.item = null;
    this.cdr.markForCheck();

    this.http
      .get<FishCardPublicDto>(
        `${environment.apiUrl}/fish-cards/by-slug/${encodeURIComponent(slug)}`,
      )
      .pipe(
        take(1),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (row) => {
          this.item = row ?? null;
          this.notFound = !row;
          if (row) {
            const scientificName = row.scientificName ? ` (${row.scientificName})` : '';
            const description = [
              `Fiche complète du ${row.commonName}${scientificName}.`,
              row.minVolumeL ? `Volume minimum : ${row.minVolumeL} litres.` : '',
              row.tempMin != null && row.tempMax != null
                ? `Température : ${row.tempMin} à ${row.tempMax} °C.`
                : '',
              row.behavior || '',
            ]
              .filter(Boolean)
              .join(' ')
              .slice(0, 160);
            const image = this.coverSrc(row.imageUrl);
            this.seo.apply({
              title: `${row.commonName}${scientificName} – Fiche poisson | AquaManager`,
              description,
              path: `/poissons/${encodeURIComponent(row.slug)}`,
              image,
              structuredData: {
                '@context': 'https://schema.org',
                '@type': 'Article',
                headline: `Fiche poisson : ${row.commonName}`,
                description,
                image: image ? [image] : undefined,
                mainEntityOfPage: `https://aquamanager.fr/poissons/${encodeURIComponent(row.slug)}`,
                about: {
                  '@type': 'Thing',
                  name: row.commonName,
                  alternateName: row.scientificName || undefined,
                },
                publisher: {
                  '@type': 'Organization',
                  name: 'AquaManager',
                },
              },
            });
          } else {
            this.seo.markNotFound();
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error(err);
          this.notFound = true;
          this.item = null;
          this.seo.markNotFound();
          this.cdr.markForCheck();
        },
      });
  }

  private computeApiOrigin(apiUrl: string): string {
    return String(apiUrl || '').replace(/\/api\/?$/, '');
  }
}
