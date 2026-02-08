import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, take } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import {
  AdminArticlesService,
  ArticleDto,
  ArticleStatus,
  ThemeDto,
} from '../../../../core/admin-articles.service';
import { UserService, UserMe } from '../../../../core/user.service';

type AppRole = 'USER' | 'EDITOR' | 'ADMIN' | 'SUPERADMIN';

@Component({
  selector: 'app-admin-article-edit',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,

    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './admin-article-edit.component.html',
  styleUrls: ['./admin-article-edit.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminArticleEditComponent implements OnInit {
  loading = false;
  saving = false;
  deleting = false;
  actioning = false; // ✅ submit/approve/reject

  articleId = 0;
  article: ArticleDto | null = null;
  themes: ThemeDto[] = [];

  me: (UserMe & { role?: string }) | null = null;

  form: FormGroup;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly api: AdminArticlesService,
    private readonly users: UserService,
    private readonly fb: FormBuilder,
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
      status: ['DRAFT' as ArticleStatus, Validators.required], // ✅ admin only en pratique
      themeId: [null as number | null, Validators.required],
    });
  }

  async ngOnInit(): Promise<void> {
    this.articleId = Number(this.route.snapshot.paramMap.get('id') || 0);

    // ✅ récupère le rôle pour adapter l’UI
    try {
      this.me = await this.users.getMe();
    } catch {
      this.me = null;
    }

    this.load();
  }

  private get role(): AppRole {
    const r = String(this.me?.role ?? '').toUpperCase();
    if (r === 'ADMIN' || r === 'SUPERADMIN' || r === 'EDITOR' || r === 'USER') return r as AppRole;
    return 'USER';
  }

  get isAdmin(): boolean {
    return this.role === 'ADMIN' || this.role === 'SUPERADMIN';
  }

  get isEditor(): boolean {
    // ✅ un admin a aussi accès aux écrans éditeur
    return this.isAdmin || this.role === 'EDITOR';
  }

  back(): void {
    this.location.back();
  }

  statusLabel(s: ArticleStatus): string {
    switch (s) {
      case 'DRAFT':
        return 'Brouillon';
      case 'PENDING_REVIEW':
        return 'En attente';
      case 'PUBLISHED':
        return 'Publié';
      case 'REJECTED':
        return 'Refusé';
      default:
        return String(s);
    }
  }

  private load(): void {
    if (!this.articleId) return;

    this.loading = true;
    this.cdr.markForCheck();

    // ✅ Themes :
    // - idéalement: côté back, /admin/articles/themes doit accepter ADMIN + EDITOR (sinon 403)
    this.api.themes().pipe(take(1)).subscribe({
      next: (t) => {
        this.themes = Array.isArray(t) ? t : [];
        this.cdr.markForCheck();
      },
      error: () => {
        this.themes = [];
        this.cdr.markForCheck();
      },
    });

    this.api
      .getById(this.articleId)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (a) => {
          this.article = a;

          // ✅ patch form
          this.form.patchValue({
            title: a.title,
            excerpt: a.excerpt ?? '',
            content: a.content,
            coverImageUrl: a.coverImageUrl ?? '',
            status: a.status,
            themeId: a.themeId,
          });

          // ✅ editor: le status n’est pas éditable → on le disable pour éviter d’envoyer PUBLISHED
          if (!this.isAdmin) {
            this.form.get('status')?.disable({ emitEvent: false });
          } else {
            // ✅ admin : au cas où on repasse sur un compte admin, on réactive
            this.form.get('status')?.enable({ emitEvent: false });
          }

          this.cdr.markForCheck();
        },
        error: (e) => {
          console.error(e);
          this.snack.open('Article introuvable', 'OK', { duration: 3000 });
          this.router.navigate(['/admin/articles']);
        },
      });
  }

  save(): void {
    if (this.form.invalid || !this.articleId) {
      this.form.markAllAsTouched();
      this.snack.open('Formulaire incomplet', 'OK', { duration: 2200 });
      return;
    }

    // ✅ rawValue inclut les champs disabled
    const raw = this.form.getRawValue();

    this.saving = true;
    this.cdr.markForCheck();

    // ✅ règles :
    // - EDITOR : on n’envoie pas "status" (le back mettra PENDING_REVIEW)
    // - ADMIN  : on envoie le status choisi
    const payload: any = {
      title: String(raw.title).trim(),
      excerpt: raw.excerpt ? String(raw.excerpt).trim() : '',
      content: String(raw.content).trim(),
      coverImageUrl: raw.coverImageUrl ? String(raw.coverImageUrl).trim() : '',
      themeId: Number(raw.themeId),
    };

    if (this.isAdmin) {
      payload.status = raw.status;
    }

    this.api
      .update(this.articleId, payload)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (updated) => {
          this.article = updated;
          this.snack.open('Article mis à jour', 'OK', { duration: 2200 });
          this.cdr.markForCheck();
        },
        error: (e) => {
          console.error(e);
          const msg = e?.error?.message || 'Erreur mise à jour';
          this.snack.open(msg, 'OK', { duration: 3500 });
        },
      });
  }

  // ✅ EDITOR -> submit
  submitForReview(): void {
    if (!this.articleId) return;

    this.actioning = true;
    this.cdr.markForCheck();

    // ✅ IMPORTANT : dans le service la vraie méthode s’appelle submitForReview()
    // (et tu peux garder un alias submit() si tu veux).
    this.api
      .submitForReview(this.articleId)
      .pipe(
        finalize(() => {
          this.actioning = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (updated) => {
          this.article = updated;
          this.snack.open('Envoyé à validation ✅', 'OK', { duration: 2200 });
          this.cdr.markForCheck();
        },
        error: (e) => {
          console.error(e);
          this.snack.open(e?.error?.message || 'Impossible d’envoyer à validation', 'OK', { duration: 3500 });
        },
      });
  }

  // ✅ ADMIN -> approve
  approve(): void {
    if (!this.articleId) return;

    this.actioning = true;
    this.cdr.markForCheck();

    this.api
      .approve(this.articleId)
      .pipe(
        finalize(() => {
          this.actioning = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (updated) => {
          this.article = updated;
          this.snack.open('Article publié ✅', 'OK', { duration: 2200 });
          this.cdr.markForCheck();
        },
        error: (e) => {
          console.error(e);
          this.snack.open(e?.error?.message || 'Impossible de valider', 'OK', { duration: 3500 });
        },
      });
  }

  // ✅ ADMIN -> reject
  reject(): void {
    if (!this.articleId) return;

    const reason = prompt('Raison du refus ?') ?? '';
    // si cancel -> null, si vide -> ok aussi (back met une valeur par défaut)
    this.actioning = true;
    this.cdr.markForCheck();

    this.api
      .reject(this.articleId, reason)
      .pipe(
        finalize(() => {
          this.actioning = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (updated) => {
          this.article = updated;
          this.snack.open('Article refusé', 'OK', { duration: 2200 });
          this.cdr.markForCheck();
        },
        error: (e) => {
          console.error(e);
          this.snack.open(e?.error?.message || 'Impossible de refuser', 'OK', { duration: 3500 });
        },
      });
  }

  delete(): void {
    if (!this.articleId) return;
    const ok = confirm('Supprimer cet article ? (irréversible)');
    if (!ok) return;

    this.deleting = true;
    this.cdr.markForCheck();

    this.api
      .delete(this.articleId)
      .pipe(
        finalize(() => {
          this.deleting = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.snack.open('Article supprimé', 'OK', { duration: 2200 });
          this.router.navigate(['/admin/articles']);
        },
        error: (e) => {
          console.error(e);
          this.snack.open(e?.error?.message || 'Erreur suppression', 'OK', { duration: 3500 });
        },
      });
  }

  openPublic(): void {
    if (!this.article?.slug) return;
    this.router.navigate(['/articles', this.article.slug]);
  }
}
