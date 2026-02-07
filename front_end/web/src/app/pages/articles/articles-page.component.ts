import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize, startWith, take } from 'rxjs';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { PublicArticlesApi, ArticleDto, ThemeDto } from '../../core/articles.public';
import { environment } from '../../../environments/environment';
import { Location } from '@angular/common';


@Component({
  selector: 'app-articles-page',
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
  templateUrl: './articles-page.component.html',
  styleUrls: ['./articles-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticlesPageComponent implements OnInit {
  loading = false;

  qCtrl = new FormControl<string>('', { nonNullable: true });

  // ✅ slug (string) et pas id (number)
  themeCtrl = new FormControl<string | null>(null);

  themes: ThemeDto[] = [];
  items: ArticleDto[] = [];

  private readonly apiOrigin = this.computeApiOrigin(environment.apiUrl);

  constructor(
    private readonly api: PublicArticlesApi,
    private readonly cdr: ChangeDetectorRef,
    private readonly location: Location,
  ) {}

  ngOnInit(): void {
    this.loadThemes();
    this.setupSearch();
    this.refresh();
  }
  goBack(): void {
  // si historique possible -> back, sinon fallback
  if (window.history.length > 1) {
    this.location.back();
    return;
  }
  // fallback propre
  window.location.href = '/';
}


  refresh(): void {
    this.loading = true;

    const q = this.qCtrl.value?.trim() || undefined;
    const theme = this.themeCtrl.value || undefined; // ✅ slug

    this.api.list({ q, theme })
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
          safe.sort(
            (a, b) =>
              this.toTime(b.publishedAt ?? b.createdAt) -
              this.toTime(a.publishedAt ?? a.createdAt),
          );
          this.items = safe;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error(err);
          this.items = [];
          this.cdr.markForCheck();
        },
      });
  }

  clear(): void {
    this.qCtrl.setValue('');
    this.themeCtrl.setValue(null);
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

  trackById = (_: number, a: ArticleDto) => a.id;

  private setupSearch(): void {
    this.qCtrl.valueChanges
      .pipe(
        startWith(this.qCtrl.value),
        debounceTime(250),
        distinctUntilChanged(),
      )
      .subscribe(() => this.refresh());

    this.themeCtrl.valueChanges
      .pipe(distinctUntilChanged())
      .subscribe(() => this.refresh());
  }

  private loadThemes(): void {
    this.api.themes().pipe(take(1)).subscribe({
      next: (t) => {
        this.themes = Array.isArray(t) ? t : [];
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error(err);
        this.themes = [];
        this.cdr.markForCheck();
      },
    });
  }

  private computeApiOrigin(apiUrl: string): string {
    return String(apiUrl || '').replace(/\/api\/?$/, '');
  }

  private toTime(dateLike: any): number {
    const t = new Date(dateLike ?? 0).getTime();
    return Number.isFinite(t) ? t : 0;
  }
}
