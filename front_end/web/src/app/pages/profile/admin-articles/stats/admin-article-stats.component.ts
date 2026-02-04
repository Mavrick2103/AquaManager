import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { finalize, take } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AdminArticlesService, ArticleStatsDto } from '../../../../core/admin-articles.service';

@Component({
  selector: 'app-admin-article-stats',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './admin-article-stats.component.html',
  styleUrls: ['./admin-article-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminArticleStatsComponent implements OnInit {
  loading = false;
  stats: ArticleStatsDto | null = null;
  articleId = 0;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly api: AdminArticlesService,
    private readonly cdr: ChangeDetectorRef,
    private readonly location: Location,
  ) {}

  ngOnInit(): void {
    this.articleId = Number(this.route.snapshot.paramMap.get('id') || 0);
    this.refresh();
  }

  back(): void {
    this.location.back();
  }

  refresh(days = 30): void {
    if (!this.articleId) return;

    this.loading = true;
    this.cdr.markForCheck();

    this.api.stats(this.articleId, days)
      .pipe(
        take(1),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (s) => (this.stats = s),
        error: (e) => {
          console.error(e);
          this.stats = null;
        },
      });
  }
}
