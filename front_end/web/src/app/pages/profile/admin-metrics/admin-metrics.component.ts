// admin-metrics.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { RouterModule } from '@angular/router';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule, MatButtonToggleChange } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';

type MetricsRange = '1d' | '7d' | '30d' | '365d' | 'all';
type Role = 'USER' | 'ADMIN' | 'EDITOR';

type NewUsersPoint = { label: string; count: number };

interface AdminMetricsDto {
  generatedAt: string;
  range: MetricsRange;
  users: {
    total: number;
    admins: number;
    newInRange: number | null;
    activeInRange: number;

    // ✅ idéal : renvoyé par le backend
    newSeries?: NewUsersPoint[];

    // ⚠️ fallback : seulement si createdAt est fourni
    latest: Array<{ id: number; fullName: string; email: string; role: Role; createdAt?: string }>;
    note?: string;
  };
  aquariums: { total: number; createdInRange: number };
  tasks: { total: number; createdInRange: number; doneTotal: number; doneInRange: number };
  measurements: { total: number; createdInRange: number };
}

@Component({
  selector: 'app-admin-metrics',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    HttpClientModule,

    MatToolbarModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatChipsModule,
    MatDividerModule,
    MatTooltipModule,
    MatListModule,
  ],
  templateUrl: './admin-metrics.component.html',
  styleUrls: ['./admin-metrics.component.scss'],
})
export class AdminMetricsComponent {
  loading = true;
  error: string | null = null;

  range: MetricsRange = '1d';
  metrics: AdminMetricsDto | null = null;

  displayedColumns = ['id', 'fullName', 'email', 'role'] as const;

  constructor(private http: HttpClient) {
    this.load();
  }

  private api(path: string) {
    const base = environment.apiUrl.replace(/\/+$/, '');
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${base}${p}`;
  }

  onRangeChange(ev: MatButtonToggleChange) {
    const r = ev.value as MetricsRange;
    this.setRange(r);
  }

  setRange(r: MetricsRange) {
    if (this.range === r) return;
    this.range = r;
    this.load();
  }

  load() {
    this.loading = true;
    this.error = null;

    this.http.get<AdminMetricsDto>(this.api(`/admin/metrics?range=${this.range}`)).subscribe({
      next: (res) => {
        this.metrics = res;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = `HTTP ${err?.status ?? '?'} — ${err?.statusText ?? 'Erreur'}`;
        console.error(err);
      },
    });
  }

  rangeLabel(): string {
    if (this.range === '1d') return 'Dernières 24h';
    if (this.range === '7d') return '7 derniers jours';
    if (this.range === '30d') return '30 derniers jours';
    if (this.range === '365d') return '12 derniers mois';
    return 'Depuis le début';
  }

  kpi(value: number | null): string {
    return value === null ? '—' : String(value);
  }

  pct(n: number | null | undefined, d: number | null | undefined): string {
    const nn = typeof n === 'number' ? n : 0;
    const dd = typeof d === 'number' ? d : 0;
    if (!dd || dd <= 0) return '—';
    return `${Math.round((nn / dd) * 100)}%`;
  }

  avg(n: number | null | undefined, d: number | null | undefined, digits = 1): string {
    const nn = typeof n === 'number' ? n : 0;
    const dd = typeof d === 'number' ? d : 0;
    if (!dd || dd <= 0) return '—';
    return (nn / dd).toFixed(digits);
  }

  roleClass(role: Role): string {
    if (role === 'ADMIN') return 'admin';
    if (role === 'EDITOR') return 'editor';
    return 'user';
  }

  roleLabel(role: Role): string {
    if (role === 'ADMIN') return 'ADMIN';
    if (role === 'EDITOR') return 'EDITOR';
    return 'USER';
  }

  // ============================
  // ✅ GRAPH : nouveaux users (LINE)
  // ============================

  newUsersSeries(): NewUsersPoint[] {
    const m = this.metrics;
    if (!m) return [];

    // ✅ cas parfait : API renvoie newSeries
    if (Array.isArray(m.users.newSeries) && m.users.newSeries.length) {
      return m.users.newSeries
        .map((p) => ({
          label: String((p as any)?.label ?? ''),
          count: Number((p as any)?.count ?? 0),
        }))
        .filter((p) => p.label.length > 0);
    }

    // ⚠️ fallback : bucketise latest (si createdAt présent)
    return this.buildSeriesFromLatest();
  }

  hasNewUsersSeries(): boolean {
    return this.newUsersSeries().length > 0;
  }

  seriesHint(): string {
    const m = this.metrics;
    if (!m) return '';
    if (m.users.newSeries?.length) return '';
    return ``;
  }

  // ---- Line chart math (SVG viewBox 0..1000 / 0..260) ----

  private maxSeriesCount(): number {
    const s = this.newUsersSeries();
    let m = 0;
    for (const p of s) m = Math.max(m, Number(p?.count ?? 0));
    return m <= 0 ? 1 : m;
  }

  linePoints(): Array<{ x: number; y: number }> {
    const arr = this.newUsersSeries();
    const n = arr.length;
    if (!n) return [];

    const max = this.maxSeriesCount();

    const left = 16;
    const right = 1000 - 16;
    const top = 16;
    const bottom = 260 - 24;

    const spanX = Math.max(1, n - 1);
    const w = right - left;
    const h = bottom - top;

    return arr.map((p, i) => {
      const x = left + (w * i) / spanX;
      const v = Number(p.count ?? 0);
      const t = Math.min(1, Math.max(0, v / max));
      const y = bottom - h * t;
      return { x, y };
    });
  }

  linePath(): string {
    const pts = this.linePoints();
    if (!pts.length) return '';
    return pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');
  }

  lineAreaPath(): string {
    const pts = this.linePoints();
    if (!pts.length) return '';

    const bottom = 260 - 24;
    const first = pts[0];
    const last = pts[pts.length - 1];

    const line = pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');

    return `${line} L ${last.x.toFixed(2)} ${bottom.toFixed(2)} L ${first.x.toFixed(2)} ${bottom.toFixed(2)} Z`;
  }

  // ----- fallback (approx) -----

  private buildSeriesFromLatest(): NewUsersPoint[] {
    const m = this.metrics;
    if (!m) return [];

    const latest = m.users.latest ?? [];
    const timestamps = latest
      .map((u) => (u.createdAt ? new Date(u.createdAt).getTime() : NaN))
      .filter((t) => Number.isFinite(t));

    if (!timestamps.length) return [];

    if (m.range === '1d') return this.bucket(timestamps, 24, 'hour');
    if (m.range === '7d') return this.bucket(timestamps, 7, 'day');
    if (m.range === '30d') return this.bucket(timestamps, 30, 'day');
    if (m.range === '365d') return this.bucket(timestamps, 12, 'month');
    return this.bucket(timestamps, 12, 'month'); // all => fallback 12 mois
  }

  private bucket(timestamps: number[], n: number, mode: 'hour' | 'day' | 'month'): NewUsersPoint[] {
    const now = new Date();
    const out: NewUsersPoint[] = [];

    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now);

      if (mode === 'hour') d.setHours(now.getHours() - i, 0, 0, 0);
      if (mode === 'day') { d.setDate(now.getDate() - i); d.setHours(0, 0, 0, 0); }
      if (mode === 'month') { d.setMonth(now.getMonth() - i, 1); d.setHours(0, 0, 0, 0); }

      const start = d.getTime();
      const end = this.nextBucketEnd(d, mode).getTime();

      const count = timestamps.filter((t) => t >= start && t < end).length;

      out.push({
        label: this.bucketLabel(d, mode),
        count,
      });
    }

    return out;
  }

  private nextBucketEnd(d: Date, mode: 'hour' | 'day' | 'month'): Date {
    const x = new Date(d);
    if (mode === 'hour') x.setHours(x.getHours() + 1);
    if (mode === 'day') x.setDate(x.getDate() + 1);
    if (mode === 'month') x.setMonth(x.getMonth() + 1);
    return x;
  }

  private bucketLabel(d: Date, mode: 'hour' | 'day' | 'month'): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');

    if (mode === 'hour') return `${String(d.getHours()).padStart(2, '0')}h`;
    if (mode === 'day') return `${dd}/${mm}`;
    return `${mm}/${String(d.getFullYear()).slice(-2)}`;
  }
}
