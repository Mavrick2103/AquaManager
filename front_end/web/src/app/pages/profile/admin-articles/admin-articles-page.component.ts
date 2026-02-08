import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
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
import { UserService, UserMe } from '../../../core/user.service';

export type AppRole = 'USER' | 'EDITOR' | 'ADMIN' | 'SUPERADMIN';
export type ArticleStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED';

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
  uniqueViewsPeriod?: number;
  periodDays?: number;
  authorId?: number; // utile si tu veux afficher “mes articles”
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
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AdminArticlesService);
  private readonly snack = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly users = inject(UserService);

  me!: UserMe & { role?: string };

  loading = false;
  saving = false;

  tabIndex = 0;
  search = '';
  statusFilter: '' | ArticleStatus = '';
  themeFilter: number | null = null;

  items: ArticleDto[] = [];
  filtered: ArticleDto[] = [];
  themes: ThemeDto[] = [];

  form: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(160)]],
    excerpt: [''],
    content: ['', [Validators.required, Validators.minLength(10)]],
    coverImageUrl: [''],
    // ✅ admin peut choisir DRAFT/PUBLISHED, editor sera forcé côté back
    status: ['DRAFT' as ArticleStatus, Validators.required],
    themeId: [null as number | null, Validators.required],
  });

  async ngOnInit(): Promise<void> {
    this.me = await this.users.getMe(); // ✅ récupère role
    this.refresh();
  }

  // ===== roles =====
  private get role(): AppRole {
    const r = String(this.me?.role ?? '').toUpperCase();
    if (r === 'ADMIN' || r === 'SUPERADMIN' || r === 'EDITOR' || r === 'USER') return r as AppRole;
    return 'USER';
  }

  get isAdmin(): boolean {
    return this.role === 'ADMIN' || this.role === 'SUPERADMIN';
  }

  get isEditor(): boolean {
    return this.role === 'EDITOR';
  }

  get canSeeAdminOnlyMenus(): boolean {
    // métriques + users uniquement admin
    return this.isAdmin;
  }

  // ===== nav =====
  back(): void {
    this.location.back();
  }

  refresh(): void {
    this.loading = true;
    this.cdr.markForCheck();

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
    const q = this.normalize(this.search);
    if (!q) {
      this.filtered = this.items;
      return;
    }
    this.filtered = this.items.filter((a) => {
      const blob = [a.title, a.excerpt, a.slug, a.status, a.theme?.name].filter(Boolean).join(' | ');
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

    // ✅ si editor, on force visuellement DRAFT (il sera PENDING_REVIEW côté back)
    if (this.isEditor) this.form.get('status')?.setValue('DRAFT');

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
    this.router.navigate(['/articles', a.slug]);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snack.open('Formulaire incomplet', 'OK', { duration: 2000 });
      return;
    }

    const raw = this.form.getRawValue();

    // ✅ editor : pas de publish côté UI
    const statusToSend: ArticleStatus = this.isAdmin ? raw.status : 'DRAFT';

    this.saving = true;
    this.cdr.markForCheck();

    this.api.create({
      title: String(raw.title).trim(),
      excerpt: raw.excerpt ? String(raw.excerpt).trim() : undefined,
      content: String(raw.content).trim(),
      coverImageUrl: raw.coverImageUrl ? String(raw.coverImageUrl).trim() : undefined,
      status: statusToSend as any,
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
          const label = this.isAdmin
            ? `Article créé (#${created.id})`
            : `Article envoyé en validation (#${created.id})`;
          this.snack.open(label, 'OK', { duration: 2200 });
          this.tabIndex = 0;
          this.refresh();
        },
        error: (err) => {
          console.error(err);
          const msg =
            err?.status === 401 ? '401 : pas connecté' :
            err?.status === 403 ? '403 : interdit' :
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

  badgeLabel(status: ArticleStatus): string {
    switch (status) {
      case 'PUBLISHED': return 'Publié';
      case 'PENDING_REVIEW': return 'En validation';
      case 'REJECTED': return 'Refusé';
      default: return 'Brouillon';
    }
  }

  badgeClass(status: ArticleStatus): string {
    switch (status) {
      case 'PUBLISHED': return 'pub';
      case 'PENDING_REVIEW': return 'pending';
      case 'REJECTED': return 'rejected';
      default: return 'draft';
    }
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
