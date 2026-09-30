import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { AdminOverview } from '../../../core/admin-overview.model';
import { AdminSidebarComponent } from '../../../shared/admin-sidebar/admin-sidebar.component';

@Component({
  selector: 'app-admin-metrics',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule, AdminSidebarComponent],
  templateUrl: './admin-metrics.component.html',
  styleUrl: './admin-metrics.component.scss',
})
export class AdminMetricsComponent implements OnDestroy {
  range = '7d';
  loading = false;
  error = '';
  metrics: AdminOverview | null = null;
  series: Array<{ label: string; count: number }> | null = null;
  private request?: Subscription;
  readonly usageLabels: Record<string, string> = {
    assistant: 'Assistant',
    ai: 'Analyses IA',
    protocols: 'Tâches de protocole',
    calendar: 'Tâches créées',
    measurements: 'Mesures',
    species: 'Fiches consultées',
  };
  constructor(private http: HttpClient) {
    this.load();
  }
  ngOnDestroy() {
    this.request?.unsubscribe();
  }
  load() {
    this.request?.unsubscribe();
    this.loading = true;
    this.error = '';
    this.metrics = null;
    const base = environment.apiUrl.replace(/\/$/, '');
    this.request = forkJoin({
      metrics: this.http.get<AdminOverview>(`${base}/admin/metrics?range=${this.range}`),
      series: this.http
        .get<
          Array<{ label: string; count: number }>
        >(`${base}/admin/metrics/series/new-users?range=${this.range}`)
        .pipe(catchError(() => of(null))),
    }).subscribe({
      next: (data) => {
        this.metrics = data.metrics;
        this.series = data.series;
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger la vue d’ensemble. Réessayez dans un instant.';
        this.loading = false;
      },
    });
  }
  get maxCount() {
    return Math.max(1, ...(this.series ?? []).map((p) => p.count));
  }
  get incidentCount() {
    const a = this.metrics?.operations.alerts;
    return a ? a.apiErrors + a.stripeFailures + (a.paypalFailures ?? 0) + a.emailFailures : 0;
  }
  plan(user: {
    subscriptionPlan: string;
    subscriptionStatus: string;
    subscriptionEndsAt: string | null;
  }) {
    return ['active', 'trialing'].includes(user.subscriptionStatus) &&
      (!user.subscriptionEndsAt || Date.parse(user.subscriptionEndsAt) > Date.now())
      ? user.subscriptionPlan
      : 'CLASSIC';
  }
}
