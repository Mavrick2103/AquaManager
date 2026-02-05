import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { finalize, take } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';

import { AdminArticlesService, ArticleStatsDto } from '../../../../core/admin-articles.service';

type Period = 'week' | 'month' | 'year';

type DailyRow = {
  day: string;
  views: number;
  uniqueViews: number;
};

@Component({
  selector: 'app-admin-article-stats',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatButtonToggleModule,
    BaseChartDirective,
  ],
  templateUrl: './admin-article-stats.component.html',
  styleUrls: ['./admin-article-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminArticleStatsComponent implements OnInit {
  loading = false;
  stats: ArticleStatsDto | null = null;
  articleId = 0;

  period: Period = 'week';

  // ✅ FIX: on force bar pour éviter TS2322
  readonly chartType: 'bar' = 'bar';

  private readonly daysForPeriod: Record<Period, number> = {
    week: 90,
    month: 365,
    year: 3650,
  };

  chartData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      { label: 'Vues', data: [] },
      { label: 'Uniques', data: [] },
    ],
  };

  chartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      tooltip: { enabled: true },
    },
    scales: {
      x: { ticks: { maxRotation: 0 } },
      y: { beginAtZero: true },
    },
  };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly api: AdminArticlesService,
    private readonly cdr: ChangeDetectorRef,
    private readonly location: Location,
  ) {}

  ngOnInit(): void {
    this.articleId = Number(this.route.snapshot.paramMap.get('id') || 0);
    this.refresh(this.daysForPeriod[this.period]);
  }

  back(): void {
    this.location.back();
  }

  periodLabel(): string {
    if (this.period === 'week') return 'semaine';
    if (this.period === 'month') return 'mois';
    return 'année';
  }

  onPeriodChange(p: Period): void {
    if (!p || p === this.period) return;
    this.period = p;
    this.refresh(this.daysForPeriod[this.period]);
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
        next: (s) => {
          this.stats = s;
          this.rebuildChart();
          this.cdr.markForCheck();
        },
        error: (e) => {
          console.error(e);
          this.stats = null;
          this.resetChart();
          this.cdr.markForCheck();
        },
      });
  }

  private resetChart(): void {
    this.chartData = {
      labels: [],
      datasets: [
        { label: 'Vues', data: [] },
        { label: 'Uniques', data: [] },
      ],
    };
  }

  private rebuildChart(): void {
    const daily = (this.stats as any)?.daily as DailyRow[] | undefined;
    if (!daily?.length) {
      this.resetChart();
      return;
    }

    const grouped = this.groupByPeriod(daily, this.period);

    this.chartData = {
      labels: grouped.map(g => g.label),
      datasets: [
        { label: 'Vues', data: grouped.map(g => g.views) },
        { label: 'Uniques', data: grouped.map(g => g.uniqueViews) },
      ],
    };
  }

  private groupByPeriod(daily: DailyRow[], period: Period) {
    const rows = [...daily]
      .map(d => ({ ...d, date: this.parseDay(d.day) }))
      .filter(d => !!d.date)
      .sort((a, b) => a.date!.getTime() - b.date!.getTime());

    const map = new Map<string, { label: string; views: number; uniqueViews: number; sortKey: number }>();

    for (const r of rows) {
      const date = r.date!;
      const k = this.keyFor(date, period);

      const prev = map.get(k.key);
      if (!prev) {
        map.set(k.key, {
          label: k.label,
          views: Number(r.views || 0),
          uniqueViews: Number(r.uniqueViews || 0),
          sortKey: k.sortKey,
        });
      } else {
        prev.views += Number(r.views || 0);
        prev.uniqueViews += Number(r.uniqueViews || 0);
      }
    }

    return [...map.values()].sort((a, b) => a.sortKey - b.sortKey);
  }

  private parseDay(day: string): Date | null {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    const d = iso.test(day) ? new Date(`${day}T00:00:00`) : new Date(day);
    return isNaN(d.getTime()) ? null : d;
  }

  private keyFor(date: Date, period: Period): { key: string; label: string; sortKey: number } {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;

    if (period === 'year') {
      return { key: `${y}`, label: `${y}`, sortKey: y * 10000 };
    }

    if (period === 'month') {
      const mm = String(m).padStart(2, '0');
      return { key: `${y}-${mm}`, label: `${mm}/${y}`, sortKey: y * 100 + m };
    }

    const { isoYear, isoWeek } = this.getISOWeek(date);
    const ww = String(isoWeek).padStart(2, '0');
    return { key: `${isoYear}-W${ww}`, label: `S${ww} ${isoYear}`, sortKey: isoYear * 100 + isoWeek };
  }

  private getISOWeek(d: Date): { isoYear: number; isoWeek: number } {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const isoYear = date.getUTCFullYear();
    const yearStart = new Date(Date.UTC(isoYear, 0, 1));
    const isoWeek = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return { isoYear, isoWeek };
  }
}
