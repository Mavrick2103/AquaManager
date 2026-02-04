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

import { AdminArticlesService, ArticleDto, ArticleStatus, ThemeDto } from '../../../../core/admin-articles.service';

@Component({
  selector: 'app-admin-article-edit',
  standalone: true,
  imports: [
    CommonModule, RouterModule, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatSnackBarModule, MatProgressSpinnerModule,
  ],
  templateUrl: './admin-article-edit.component.html',
  styleUrls: ['./admin-article-edit.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminArticleEditComponent implements OnInit {
  loading = false;
  saving = false;
  deleting = false;

  articleId = 0;
  article: ArticleDto | null = null;
  themes: ThemeDto[] = [];

  form: FormGroup;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly api: AdminArticlesService,
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
      status: ['DRAFT' as ArticleStatus, Validators.required],
      themeId: [null as number | null, Validators.required],
    });
  }

  ngOnInit(): void {
    this.articleId = Number(this.route.snapshot.paramMap.get('id') || 0);
    this.load();
  }

  back(): void {
    this.location.back();
  }

  private load(): void {
    if (!this.articleId) return;

    this.loading = true;
    this.cdr.markForCheck();

    this.api.themes().pipe(take(1)).subscribe({
      next: (t) => { this.themes = Array.isArray(t) ? t : []; this.cdr.markForCheck(); },
      error: () => { this.themes = []; this.cdr.markForCheck(); },
    });

    this.api.getById(this.articleId)
      .pipe(finalize(() => { this.loading = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: (a) => {
          this.article = a;
          this.form.patchValue({
            title: a.title,
            excerpt: a.excerpt ?? '',
            content: a.content,
            coverImageUrl: a.coverImageUrl ?? '',
            status: a.status,
            themeId: a.themeId,
          });
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

    const raw = this.form.getRawValue();

    this.saving = true;
    this.cdr.markForCheck();

    this.api.update(this.articleId, {
      title: String(raw.title).trim(),
      excerpt: raw.excerpt ? String(raw.excerpt).trim() : '',
      content: String(raw.content).trim(),
      coverImageUrl: raw.coverImageUrl ? String(raw.coverImageUrl).trim() : '',
      status: raw.status,
      themeId: Number(raw.themeId),
    })
      .pipe(finalize(() => { this.saving = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: (updated) => {
          this.article = updated;
          this.snack.open('Article mis à jour', 'OK', { duration: 2200 });
          this.cdr.markForCheck();
        },
        error: (e) => {
          console.error(e);
          this.snack.open('Erreur mise à jour', 'OK', { duration: 3500 });
        },
      });
  }

  delete(): void {
    if (!this.articleId) return;
    const ok = confirm('Supprimer cet article ? (irréversible)');
    if (!ok) return;

    this.deleting = true;
    this.cdr.markForCheck();

    this.api.delete(this.articleId)
      .pipe(finalize(() => { this.deleting = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: () => {
          this.snack.open('Article supprimé', 'OK', { duration: 2200 });
          this.router.navigate(['/admin/articles']);
        },
        error: (e) => {
          console.error(e);
          this.snack.open('Erreur suppression', 'OK', { duration: 3500 });
        },
      });
  }

  openPublic(): void {
    if (!this.article?.slug) return;
    this.router.navigate(['/articles', this.article.slug]);
  }
}
