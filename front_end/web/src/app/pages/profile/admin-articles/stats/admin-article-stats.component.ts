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
  day: string; // "YYYY-MM-DD" le plus souvent
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

  // période analysée (refetch)
  rangeDays = 30;

  // regroupement (local only)
  period: Period = 'week';

  // ===== GRAPH 1 (daily line) =====
  readonly dailyChartType: 'line' = 'line';

  dailyChartData: ChartData<'line'> = {
    labels: [],
    datasets: [
      { label: 'Vues', data: [] },
      { label: 'Uniques', data: [] },
    ],
  };

  dailyChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      tooltip: {
        enabled: true,
        callbacks: {
          title: (items) => {
            const i = items?.[0];
            const raw = String(i?.label ?? '');
            // label = dd/MM/yyyy
            return raw ? `Date : ${raw}` : '';
          },
        },
      },
    },
    elements: {
      line: { tension: 0.25 },
      point: { radius: 2, hitRadius: 10 },
    },
    scales: {
      x: { ticks: { maxRotation: 0 } },
      y: { beginAtZero: true },
    },
  };

  // ===== GRAPH 2 (grouped bar) =====
  readonly groupedChartType: 'bar' = 'bar';

  groupedChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      { label: 'Vues', data: [] },
      { label: 'Uniques', data: [] },
    ],
  };

  groupedChartOptions: ChartConfiguration<'bar'>['options'] = {
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
    this.refresh();
  }

  back(): void {
    this.location.back();
  }

  onPeriodChange(p: Period): void {
    if (!p || p === this.period) return;
    this.period = p;
    this.rebuildCharts();
    this.cdr.markForCheck();
  }

  onRangeChange(days: number): void {
    if (!days || days === this.rangeDays) return;
    this.rangeDays = days;
    this.refresh();
  }

  refresh(): void {
    if (!this.articleId) return;

    this.loading = true;
    this.cdr.markForCheck();

    this.api
      .stats(this.articleId, this.rangeDays)
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
          this.rebuildCharts();
          this.cdr.markForCheck();
        },
        error: (e) => {
          console.error(e);
          this.stats = null;
          this.resetCharts();
          this.cdr.markForCheck();
        },
      });
  }

  // ======================
  // ===== KPIs clairs =====
  // ======================

  get avgViewsPerDay(): number {
    const days = Number(this.stats?.days || 0);
    const total = Number(this.stats?.totalViewsPeriod || 0);
    if (!days) return 0;
    return Math.round(total / Math.max(1, days));
  }

  get bestDayViews(): number {
    const daily = (this.stats as any)?.daily as DailyRow[] | undefined;
    if (!daily?.length) return 0;
    return daily.reduce((max, d) => Math.max(max, Number(d.views || 0)), 0);
  }

  get bestDayLabel(): string {
    const daily = (this.stats as any)?.daily as DailyRow[] | undefined;
    if (!daily?.length) return '-';
    const best = daily.reduce(
      (acc, d) => (Number(d.views || 0) > Number(acc.views || 0) ? d : acc),
      daily[0],
    );
    return this.formatDay(best.day);
  }

  get groupedLegend(): string {
    if (this.period === 'week') return 'Chaque barre = 1 semaine (ex : S12 (18/03–24/03))';
    if (this.period === 'month') return 'Chaque barre = 1 mois (ex : 03/2025)';
    return 'Chaque barre = 1 année (ex : 2025)';
  }

  // ======================
  // ===== Dates UI =====
  // ======================

  formatDay(day: string): string {
    const d = this.parseDay(day);
    return d ? this.formatDateFR(d) : day;
  }

  private formatDateFR(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  }

  // ======================
  // ===== Charts =====
  // ======================

  private resetCharts(): void {
    this.dailyChartData = {
      labels: [],
      datasets: [
        { label: 'Vues', data: [] },
        { label: 'Uniques', data: [] },
      ],
    };

    this.groupedChartData = {
      labels: [],
      datasets: [
        { label: 'Vues', data: [] },
        { label: 'Uniques', data: [] },
      ],
    };
  }

  private rebuildCharts(): void {
    const daily = (this.stats as any)?.daily as DailyRow[] | undefined;

    if (!daily?.length) {
      this.resetCharts();
      return;
    }

    const sortedDaily = [...daily]
      .map((d) => ({ ...d, date: this.parseDay(d.day) }))
      .filter((d) => !!d.date)
      .sort((a, b) => a.date!.getTime() - b.date!.getTime());

    // ✅ Graph 1 : line daily (labels FR)
    this.dailyChartData = {
      labels: sortedDaily.map((d) => this.formatDateFR(d.date!)),
      datasets: [
        { label: 'Vues', data: sortedDaily.map((d) => Number(d.views || 0)) },
        { label: 'Uniques', data: sortedDaily.map((d) => Number(d.uniqueViews || 0)) },
      ],
    };

    // ✅ Graph 2 : grouped bar (labels lisibles)
    const grouped = this.groupByPeriod(sortedDaily as any, this.period);

    this.groupedChartData = {
      labels: grouped.map((g) => g.label),
      datasets: [
        { label: 'Vues', data: grouped.map((g) => g.views) },
        { label: 'Uniques', data: grouped.map((g) => g.uniqueViews) },
      ],
    };
  }

  private groupByPeriod(rows: Array<DailyRow & { date: Date }>, period: Period) {
    const map = new Map<
      string,
      { label: string; views: number; uniqueViews: number; sortKey: number }
    >();

    for (const r of rows) {
      const k = this.keyFor(r.date, period);
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
    // day attendu: "YYYY-MM-DD"
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

    // week : label "S12 (18/03–24/03)"
    const { isoYear, isoWeek, weekStart, weekEnd } = this.getISOWeekRange(date);
    const ww = String(isoWeek).padStart(2, '0');

    const start = this.formatShortDayMonth(weekStart);
    const end = this.formatShortDayMonth(weekEnd);

    return {
      key: `${isoYear}-W${ww}`,
      label: `S${ww} (${start}–${end})`,
      sortKey: isoYear * 100 + isoWeek,
    };
  }

  private formatShortDayMonth(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  }

  private getISOWeekRange(d: Date): {
    isoYear: number;
    isoWeek: number;
    weekStart: Date;
    weekEnd: Date;
  } {
    // basé sur ISO week (lundi->dimanche)
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7; // 1..7

    // jeudi de la semaine ISO
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const isoYear = date.getUTCFullYear();

    const yearStart = new Date(Date.UTC(isoYear, 0, 1));
    const isoWeek = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

    // start monday
    const weekStart = new Date(date);
    weekStart.setUTCDate(date.getUTCDate() - 3); // jeudi -> lundi

    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

    // repasse en Date locale (juste pour format)
    return {
      isoYear,
      isoWeek,
      weekStart: new Date(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate()),
      weekEnd: new Date(weekEnd.getUTCFullYear(), weekEnd.getUTCMonth(), weekEnd.getUTCDate()),
    };
  }
}
