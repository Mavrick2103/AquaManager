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

import { environment } from '../../../../environments/environment';
import { SeoService } from '../../../core/seo.service';

type WaterType = 'EAU_DOUCE' | 'EAU_DE_MER' | 'SAUMATRE';

export type PlantCardPublicDto = {
  id: number;
  slug: string;

  commonName: string;
  scientificName: string | null;
  family: string | null;
  origin: string | null;
  waterType: WaterType;

  category: string | null;
  placement: string | null;
  growthRate: string | null;
  maxHeightCm: number | string | null;
  propagation: string | null;

  light: string | null;
  co2: string | null;
  difficulty: 'FACILE' | 'MOYEN' | 'DIFFICILE' | null;

  tempMin: number | string | null;
  tempMax: number | string | null;
  phMin: number | string | null;
  phMax: number | string | null;
  ghMin: number | string | null;
  ghMax: number | string | null;
  khMin: number | string | null;
  khMax: number | string | null;

  needsFe: boolean | null;
  needsNo3: boolean | null;
  needsPo4: boolean | null;
  needsK: boolean | null;
  substrateRequired: boolean | null;

  trimming: string | null;
  compatibility: string | null;
  notes: string | null;

  imageUrl: string | null;
};

@Component({
  selector: 'app-plant-card-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
  ],
  templateUrl: './plant-card-detail-page.component.html',
  styleUrls: ['./plant-card-detail-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlantCardDetailPageComponent implements OnInit {
  loading = false;
  notFound = false;

  item: PlantCardPublicDto | null = null;

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

    window.location.href = '/plantes';
  }

  refresh(): void {
    const slug = this.route.snapshot.paramMap.get('slug');

    if (!slug) return;

    this.fetch(slug);
  }

  coverSrc(raw: unknown): string | null {
    const v = String(raw ?? '').trim();
    if (!v) return null;

    if (/^https?:\/\//i.test(v) || v.startsWith('data:')) {
      return v;
    }

    const normalized = v.startsWith('/') ? v : `/${v}`;

    if (normalized.startsWith('/uploads/')) {
      return `${this.apiOrigin}${normalized}`;
    }

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

  yesNo(v: boolean | null | undefined): string {
    if (v === true) return 'Oui';
    if (v === false) return 'Non';

    return '—';
  }

  private fetch(slug: string): void {
    this.loading = true;
    this.notFound = false;
    this.item = null;
    this.cdr.markForCheck();

    this.http
      .get<PlantCardPublicDto>(
        `${environment.apiUrl}/plant-cards/by-slug/${encodeURIComponent(slug)}`,
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
              `Fiche complète de la plante ${row.commonName}${scientificName}.`,
              row.placement ? `Placement : ${row.placement}.` : '',
              row.light ? `Éclairage : ${row.light}.` : '',
              row.notes || '',
            ]
              .filter(Boolean)
              .join(' ')
              .slice(0, 160);
            const image = this.coverSrc(row.imageUrl);
            this.seo.apply({
              title: `${row.commonName}${scientificName} – Fiche plante | AquaManager`,
              description,
              path: `/plantes/${encodeURIComponent(row.slug)}`,
              image,
              structuredData: {
                '@context': 'https://schema.org',
                '@type': 'Article',
                headline: `Fiche plante : ${row.commonName}`,
                description,
                image: image ? [image] : undefined,
                mainEntityOfPage: `https://aquamanager.fr/plantes/${encodeURIComponent(row.slug)}`,
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
