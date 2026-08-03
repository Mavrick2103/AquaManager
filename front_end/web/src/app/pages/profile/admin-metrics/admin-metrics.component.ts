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
import { AdminSidebarComponent } from '../../../shared/admin-sidebar/admin-sidebar.component';

type MetricsRange = '1d' | '7d' | '30d' | '365d' | 'all';
type Role = 'USER' | 'ADMIN' | 'EDITOR';

type NewUsersPoint = { label: string; count: number };
type ActiveUsersPoint = { label: string; count: number };
type SubscriptionPoint = { label: string; premium: number; pro: number; total: number };
type ActivityBar = { label: string; value: number; icon: string; tone: string };

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
  subscriptions: {
    premiumActive: number;
    proActive: number;
    totalActive: number;
  };
  aquariums: { total: number; createdInRange: number };
  tasks: { total: number; createdInRange: number; doneTotal: number; doneInRange: number };
  measurements: { total: number; createdInRange: number };
  attention: { unverifiedUsers: number; inactiveUsers: number; overdueTasks: number };
  moderation: {
    pendingArticles: number;
    pendingFishCards: number;
    pendingPlantCards: number;
    totalPending: number;
  };
  content: { publishedArticles: number; approvedFishCards: number; approvedPlantCards: number };
  operations: {
    infrastructure: {
      mysql: 'ok' | 'error';
      disk: { status: 'ok' | 'warning' | 'critical' | 'unknown'; freeBytes: number | null; totalBytes: number | null; usedPercent: number | null };
      backup: { status: 'ok' | 'warning' | 'critical' | 'unknown'; lastAt: string | null; ageHours: number | null };
    };
    alerts: {
      trackingAvailable: boolean;
      apiErrors: number;
      stripeFailures: number;
      emailFailures: number;
      recent: Array<{ type: string; route: string; statusCode: number; createdAt: string }>;
    };
  };
  featureUsage: Record<string, { events: number; users: number; detail?: string }>;
}

@Component({
  selector: 'app-admin-metrics',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    HttpClientModule,
    AdminSidebarComponent,

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
  private _subscriptionsSeries: SubscriptionPoint[] = [];

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

  const subscriptions$ = this.http
    .get<SubscriptionPoint[]>(this.api(`/admin/metrics/series/subscriptions?range=${this.range}`))
    .pipe(
      catchError((err) => {
        console.error('subscriptions series error', err);
        return of([] as SubscriptionPoint[]);
      }),
    );

  forkJoin({
    metrics: metrics$,
    newUsers: newUsers$,
    activeUsers: activeUsers$,
    subscriptions: subscriptions$,
  }).subscribe({
    next: ({ metrics, newUsers, activeUsers, subscriptions }) => {
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

      this._subscriptionsSeries = (Array.isArray(subscriptions) ? subscriptions : [])
        .map((p) => ({
          label: String((p as any)?.label ?? ''),
          premium: Number((p as any)?.premium ?? 0),
          pro: Number((p as any)?.pro ?? 0),
          total: Number((p as any)?.total ?? 0),
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

  totalAttention(): number {
    if (!this.metrics) return 0;
    return (
      this.metrics.moderation.totalPending +
      this.metrics.attention.unverifiedUsers +
      this.metrics.attention.overdueTasks
    );
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
  subscriptionsSeries(): SubscriptionPoint[] {
  return this._subscriptionsSeries;
}

hasSubscriptionsSeries(): boolean {
  return this._subscriptionsSeries.length > 0;
}

maxSubscriptionsTotal(): number {
  let max = 0;

  for (const p of this._subscriptionsSeries) {
    max = Math.max(max, Number(p.total ?? 0));
  }

  return max <= 0 ? 1 : max;
}

subscriptionBarHeight(value: number): number {
  const max = this.maxSubscriptionsTotal();
  return Math.max(4, Math.round((Number(value ?? 0) / max) * 100));
}

classicAccounts(): number {
  if (!this.metrics) return 0;
  return Math.max(0, this.metrics.users.total - this.metrics.subscriptions.totalActive);
}

planPercent(value: number): number {
  const total = this.metrics?.users.total ?? 0;
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

planDonutStyle(): string {
  if (!this.metrics || this.metrics.users.total <= 0) {
    return 'conic-gradient(#e5e7eb 0 100%)';
  }

  const premium = (this.metrics.subscriptions.premiumActive / this.metrics.users.total) * 100;
  const pro = (this.metrics.subscriptions.proActive / this.metrics.users.total) * 100;
  const proEnd = premium + pro;
  return `conic-gradient(#299fbc 0 ${premium}%, #7859b3 ${premium}% ${proEnd}%, #d9e2e5 ${proEnd}% 100%)`;
}

activityBars(): ActivityBar[] {
  if (!this.metrics) return [];
  return [
    { label: 'Inscriptions', value: this.metrics.users.newInRange ?? 0, icon: 'person_add', tone: 'users' },
    { label: 'Aquariums créés', value: this.metrics.aquariums.createdInRange, icon: 'waves', tone: 'aquariums' },
    { label: 'Mesures ajoutées', value: this.metrics.measurements.createdInRange, icon: 'science', tone: 'measures' },
    { label: 'Tâches créées', value: this.metrics.tasks.createdInRange, icon: 'checklist', tone: 'tasks' },
  ];
}

activityBarHeight(value: number): number {
  const max = Math.max(1, ...this.activityBars().map((item) => item.value));
  return value <= 0 ? 3 : Math.max(8, Math.round((value / max) * 100));
}

formatBytes(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Indisponible';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let current = value;
  let unit = 0;
  while (current >= 1024 && unit < units.length - 1) { current /= 1024; unit++; }
  return `${current.toFixed(unit >= 3 ? 1 : 0)} ${units[unit]}`;
}

featureRows(): Array<{ key: string; label: string; icon: string; events: number; users: number }> {
  const usage = this.metrics?.featureUsage;
  if (!usage) return [];
  return [
    { key: 'assistant', label: 'Assistant intelligent', icon: 'psychology_alt', ...usage['assistant'] },
    { key: 'ai', label: 'Intelligence artificielle', icon: 'auto_awesome', ...usage['ai'] },
    { key: 'protocols', label: 'Protocoles', icon: 'assignment_turned_in', ...usage['protocols'] },
    { key: 'calendar', label: 'Calendrier', icon: 'calendar_month', ...usage['calendar'] },
    { key: 'measurements', label: 'Mesures', icon: 'science', ...usage['measurements'] },
    { key: 'species', label: 'Fiches espèces', icon: 'pets', ...usage['species'] },
  ];
}

featureWidth(value: number): number {
  const max = Math.max(1, ...this.featureRows().map((row) => row.events));
  return value <= 0 ? 0 : Math.max(5, Math.round((value / max) * 100));
}
}
