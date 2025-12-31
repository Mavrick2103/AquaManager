import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterModule } from '@angular/router';

type MetricsRange = '7d' | '30d' | 'all';
type Role = 'USER' | 'ADMIN';

interface AdminMetricsDto {
  generatedAt: string;
  range: MetricsRange;
  users: {
    total: number;
    admins: number;
    newInRange: number | null;
    activeInRange: number;
    latest: Array<{ id: number; fullName: string; email: string; role: Role }>;
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
    MatToolbarModule,
    MatCardModule,
    MatIconModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatChipsModule,
    MatDividerModule,
    MatTooltipModule,
    RouterModule,
  ],
  templateUrl: './admin-metrics.component.html',
  styleUrls: ['./admin-metrics.component.scss'],
})
export class AdminMetricsComponent {
  loading = true;
  error: string | null = null;

  range: MetricsRange = 'all';
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
    if (this.range === '7d') return '7 derniers jours';
    if (this.range === '30d') return '30 derniers jours';
    return 'Depuis le début';
  }

  kpi(value: number | null) {
    return value === null ? '—' : value;
  }
}
