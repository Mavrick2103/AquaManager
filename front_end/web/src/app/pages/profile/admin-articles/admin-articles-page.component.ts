import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { finalize, switchMap, take } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AdminArticlesService } from '../../../core/admin-articles.service';

export type ArticleStatus = 'DRAFT' | 'PUBLISHED';

export interface ThemeDto {
  id: number;
  name: string;
  slug: string;
}

export interface ArticleDto {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImageUrl: string | null;
  status: ArticleStatus;
  viewsCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  themeId: number;
  theme?: ThemeDto;
  uniqueViewsPeriod?: number; // uniques sur la période (ex: 30j)
  periodDays?: number;        // nb de jours utilisé (ex: 30)
}

@Component({
  selector: 'app-admin-articles-page',
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
    MatListModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './admin-articles-page.component.html',
  styleUrls: ['./admin-articles-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminArticlesPageComponent implements OnInit {
  loading = false;
  saving = false;

  tabIndex = 0; // 0 = Liste / 1 = Création
  search = '';
  statusFilter: '' | ArticleStatus = '';
  themeFilter: number | null = null;

  items: ArticleDto[] = [];
  filtered: ArticleDto[] = [];
  themes: ThemeDto[] = [];

  form: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly api: AdminArticlesService,
    private readonly snack: MatSnackBar,
    private readonly router: Router,
    private readonly location: Location,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(160)]],
      excerpt: [''],
      content: ['', [Validators.required, Validators.minLength(10)]],
      coverImageUrl: [''],
      status: ['DRAFT' as ArticleStatus, Validators.required],
      themeId: [null as number | null, Validators.required],
    });
  }

  ngOnInit(): void {
    this.refresh();
  }

  back(): void {
    this.location.back();
  }

  refresh(): void {
    this.loading = true;
    this.cdr.markForCheck();

    // Charge themes + list (en parallèle simple)
    this.api.themes()
      .pipe(
        take(1),
        switchMap((themes) => {
          this.themes = Array.isArray(themes) ? themes : [];
          return this.api.list({
            q: this.search || undefined,
            status: this.statusFilter || undefined,
            themeId: this.themeFilter || undefined,
          });
        }),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (rows) => {
          const safe = Array.isArray(rows) ? rows : [];
          safe.sort((a, b) => this.toTime(b.createdAt) - this.toTime(a.createdAt));
          this.items = safe;
          this.applyClientFilter();
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error(err);
          this.snack.open('Erreur chargement articles', 'OK', { duration: 3500 });
          this.cdr.markForCheck();
        },
      });
  }

  onSearchChange(ev: Event): void {
    this.search = (ev.target as HTMLInputElement).value ?? '';
    this.applyClientFilter();
    this.cdr.markForCheck();
  }

  onStatusChange(v: '' | ArticleStatus): void {
    this.statusFilter = v;
    this.refresh();
  }

  onThemeChange(v: number | null): void {
    this.themeFilter = v;
    this.refresh();
  }

  private applyClientFilter(): void {
    // on garde un petit filtre client pour title/excerpt/theme en plus,
    // mais la vraie recherche reste backend via refresh() si tu veux.
    const q = this.normalize(this.search);
    if (!q) {
      this.filtered = this.items;
      return;
    }
    this.filtered = this.items.filter((a) => {
      const blob = [
        a.title,
        a.excerpt,
        a.slug,
        a.status,
        a.theme?.name,
      ].filter(Boolean).join(' | ');
      return this.normalize(blob).includes(q);
    });
  }

  newArticle(): void {
    this.form.reset({
      title: '',
      excerpt: '',
      content: '',
      coverImageUrl: '',
      status: 'DRAFT',
      themeId: this.themes?.[0]?.id ?? null,
    });
    this.tabIndex = 1;
    this.cdr.markForCheck();
  }

 goStats(a: ArticleDto, ev: MouseEvent): void {
  ev.stopPropagation();
  this.router.navigate(['/admin/articles', a.id, 'stats']);
}

goEdit(a: ArticleDto, ev: MouseEvent): void {
  ev.stopPropagation();
  this.router.navigate(['/admin/articles', a.id, 'edit']);
}

openArticle(a: ArticleDto): void {
  // ouvre la page PUBLIC de l'article
  this.router.navigate(['/articles', a.slug]);
}


  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snack.open('Formulaire incomplet', 'OK', { duration: 2000 });
      return;
    }

    const raw = this.form.getRawValue();

    this.saving = true;
    this.cdr.markForCheck();

    this.api.create({
      title: String(raw.title).trim(),
      excerpt: raw.excerpt ? String(raw.excerpt).trim() : undefined,
      content: String(raw.content).trim(),
      coverImageUrl: raw.coverImageUrl ? String(raw.coverImageUrl).trim() : undefined,
      status: raw.status,
      themeId: Number(raw.themeId),
    })
      .pipe(
        take(1),
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (created) => {
          this.snack.open(`Article créé (#${created.id})`, 'OK', { duration: 2200 });
          this.tabIndex = 0;
          this.refresh();
        },
        error: (err) => {
          console.error(err);
          const msg =
            err?.status === 401 ? '401 : pas connecté' :
            err?.status === 403 ? '403 : pas ADMIN' :
            err?.status === 400 ? '400 : données invalides' :
            'Erreur création article';
          this.snack.open(msg, 'OK', { duration: 4500 });
          this.cdr.markForCheck();
        },
      });
  }

  themeName(id: number): string {
    return this.themes?.find(t => t.id === id)?.name ?? '—';
  }

  badgeClass(status: ArticleStatus): string {
    return status === 'PUBLISHED' ? 'pub' : 'draft';
  }

  private normalize(v: unknown): string {
    return String(v ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  private toTime(dateLike: any): number {
    const t = new Date(dateLike ?? 0).getTime();
    return Number.isFinite(t) ? t : 0;
  }
}
