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

import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

type MetricsRange = '1d' | '7d' | '30d' | '365d' | 'all';
type Role = 'USER' | 'ADMIN' | 'EDITOR';

type NewUsersPoint = { label: string; count: number };
type ActiveUsersPoint = { label: string; count: number };

interface AdminMetricsDto {
  generatedAt: string;
  range: MetricsRange;
  users: {
    total: number;
    admins: number;
    newInRange: number | null;
    activeInRange: number;
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

  private _newUsersSeries: NewUsersPoint[] = [];
  private _activeUsersSeries: ActiveUsersPoint[] = [];

  // hover new users
  hoverIndex: number | null = null;
  tipLeft = 0;
  tipTop = 0;

  // hover active users
  activeHoverIndex: number | null = null;
  activeTipLeft = 0;
  activeTipTop = 0;

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

  this.hoverIndex = null;
  this.activeHoverIndex = null;

  const metrics$ = this.http.get<AdminMetricsDto>(
    this.api(`/admin/metrics?range=${this.range}`),
  );

  const newUsers$ = this.http
    .get<NewUsersPoint[]>(this.api(`/admin/metrics/series/new-users?range=${this.range}`))
    .pipe(
      catchError((err) => {
        console.error('new-users series error', err);
        return of([] as NewUsersPoint[]);
      }),
    );

  const activeUsers$ = this.http
    .get<ActiveUsersPoint[]>(this.api(`/admin/metrics/series/active-users?range=${this.range}`))
    .pipe(
      catchError((err) => {
        console.error('active-users series error', err);
        return of([] as ActiveUsersPoint[]);
      }),
    );

  forkJoin({ metrics: metrics$, newUsers: newUsers$, activeUsers: activeUsers$ }).subscribe({
    next: ({ metrics, newUsers, activeUsers }) => {
      this.metrics = metrics;

      this._newUsersSeries = (Array.isArray(newUsers) ? newUsers : [])
        .map((p) => ({
          label: String((p as any)?.label ?? ''),
          count: Number((p as any)?.count ?? 0),
        }))
        .filter((p) => p.label.length > 0);

      this._activeUsersSeries = (Array.isArray(activeUsers) ? activeUsers : [])
        .map((p) => ({
          label: String((p as any)?.label ?? ''),
          count: Number((p as any)?.count ?? 0),
        }))
        .filter((p) => p.label.length > 0);

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
  // ✅ Graph 1 : Nouveaux users
  // ============================
  newUsersSeries(): NewUsersPoint[] {
    return this._newUsersSeries;
  }

  hasNewUsersSeries(): boolean {
    return this._newUsersSeries.length > 0;
  }

  seriesHint(): string {
    return '';
  }

  private maxNewUsersCount(): number {
    let m = 0;
    for (const p of this._newUsersSeries) m = Math.max(m, Number(p?.count ?? 0));
    return m <= 0 ? 1 : m;
  }

  linePoints(): Array<{ x: number; y: number }> {
    const arr = this._newUsersSeries;
    const n = arr.length;
    if (!n) return [];

    const max = this.maxNewUsersCount();

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

  safePoint(i: number | null): { x: number; y: number } | null {
    if (i === null) return null;
    const pts = this.linePoints();
    if (!pts.length) return null;
    if (i < 0 || i >= pts.length) return null;
    return pts[i];
  }

  linePath(): string {
    const pts = this.linePoints();
    if (!pts.length) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  }

  lineAreaPath(): string {
    const pts = this.linePoints();
    if (!pts.length) return '';

    const bottom = 260 - 24;
    const first = pts[0];
    const last = pts[pts.length - 1];

    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');

    return `${line} L ${last.x.toFixed(2)} ${bottom.toFixed(2)} L ${first.x.toFixed(2)} ${bottom.toFixed(2)} Z`;
  }

  setHoverIndex(i: number) {
    this.hoverIndex = i;
  }

  onChartLeave() {
    this.hoverIndex = null;
  }

  onChartMove(ev: MouseEvent) {
    const pts = this.linePoints();
    if (!pts.length) return;

    const el = ev.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 1000;

    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.abs(pts[i].x - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }

    this.hoverIndex = best;

    const px = (pts[best].x / 1000) * rect.width;
    const py = (pts[best].y / 260) * rect.height;

    this.tipLeft = px;
    this.tipTop = Math.max(6, py - 48);
  }

  // ============================
  // ✅ Graph 2 : Utilisateurs actifs
  // ============================
  activeUsersSeries(): ActiveUsersPoint[] {
    return this._activeUsersSeries;
  }

  hasActiveUsersSeries(): boolean {
    return this._activeUsersSeries.length > 0;
  }

  private maxActiveUsersCount(): number {
    let m = 0;
    for (const p of this._activeUsersSeries) m = Math.max(m, Number(p?.count ?? 0));
    return m <= 0 ? 1 : m;
  }

  activeLinePoints(): Array<{ x: number; y: number }> {
    const arr = this._activeUsersSeries;
    const n = arr.length;
    if (!n) return [];

    const max = this.maxActiveUsersCount();

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

  safeActivePoint(i: number | null): { x: number; y: number } | null {
    if (i === null) return null;
    const pts = this.activeLinePoints();
    if (!pts.length) return null;
    if (i < 0 || i >= pts.length) return null;
    return pts[i];
  }

  activeLinePath(): string {
    const pts = this.activeLinePoints();
    if (!pts.length) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  }

  activeLineAreaPath(): string {
    const pts = this.activeLinePoints();
    if (!pts.length) return '';

    const bottom = 260 - 24;
    const first = pts[0];
    const last = pts[pts.length - 1];

    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');

    return `${line} L ${last.x.toFixed(2)} ${bottom.toFixed(2)} L ${first.x.toFixed(2)} ${bottom.toFixed(2)} Z`;
  }

  setActiveHoverIndex(i: number) {
    this.activeHoverIndex = i;
  }

  onActiveChartLeave() {
    this.activeHoverIndex = null;
  }

  onActiveChartMove(ev: MouseEvent) {
    const pts = this.activeLinePoints();
    if (!pts.length) return;

    const el = ev.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 1000;

    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.abs(pts[i].x - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }

    this.activeHoverIndex = best;

    const px = (pts[best].x / 1000) * rect.width;
    const py = (pts[best].y / 260) * rect.height;

    this.activeTipLeft = px;
    this.activeTipTop = Math.max(6, py - 48);
  }
}
