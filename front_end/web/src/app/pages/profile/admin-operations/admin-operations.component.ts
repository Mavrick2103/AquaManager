import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { InfrastructureHealth } from '../../../core/admin-overview.model';
import { AdminSidebarComponent } from '../../../shared/admin-sidebar/admin-sidebar.component';
interface LogPage {
  items: Array<{ id: number; type: string; route: string; statusCode: number; createdAt: string }>;
  total: number;
  generatedAt: string;
}
@Component({
  selector: 'app-admin-operations',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, AdminSidebarComponent],
  templateUrl: './admin-operations.component.html',
  styleUrl: './admin-operations.component.scss',
})
export class AdminOperationsComponent implements OnDestroy {
  range = '7d';
  type = 'all';
  route = '';
  page = 1;
  logs: LogPage | null = null;
  health: InfrastructureHealth | null = null;
  loading = false;
  healthLoading = false;
  error = '';
  healthError = '';
  private requests: Subscription[] = [];
  private logRequest?: Subscription;
  private readonly base = environment.apiUrl.replace(/\/$/, '');
  readonly labels: Record<string, string> = {
    API_ERROR: 'API',
    PAYPAL_FAILURE: 'Parcours PayPal',
    STRIPE_FAILURE: 'Parcours Stripe',
    EMAIL_FAILURE: 'Parcours email',
  };
  constructor(private http: HttpClient) {
    this.refresh();
  }
  ngOnDestroy() {
    this.logRequest?.unsubscribe();
    this.requests.forEach((r) => r.unsubscribe());
  }
  refresh() {
    this.load(true);
    this.loadHealth();
  }
  loadHealth() {
    this.requests.forEach((r) => r.unsubscribe());
    this.healthLoading = true;
    this.healthError = '';
    this.health = null;
    this.requests = [
      this.http.get<InfrastructureHealth>(`${this.base}/admin/operations/health`).subscribe({
        next: (h) => {
          this.health = h;
          this.healthLoading = false;
        },
        error: () => {
          this.healthError = 'État du serveur indisponible.';
          this.healthLoading = false;
        },
      }),
    ];
  }
  load(reset = false) {
    if (reset) this.page = 1;
    this.logRequest?.unsubscribe();
    this.loading = true;
    this.error = '';
    this.logs = null;
    const params = new HttpParams()
      .set('range', this.range)
      .set('type', this.type)
      .set('route', this.route)
      .set('page', this.page);
    this.logRequest = this.http
      .get<LogPage>(`${this.base}/admin/operations`, { params })
      .subscribe({
        next: (l) => {
          this.logs = l;
          this.loading = false;
        },
        error: () => {
          this.error =
            'Journal indisponible. Cela ne signifie pas qu’aucun incident ne s’est produit.';
          this.loading = false;
        },
      });
  }
  next(delta: number) {
    this.page += delta;
    this.load();
  }
  status(value: string) {
    return (
      (
        {
          ok: 'Normal',
          warning: 'À surveiller',
          critical: 'Alerte',
          unknown: 'Non vérifié',
          error: 'Erreur',
        } as Record<string, string>
      )[value] ?? 'Non vérifié'
    );
  }
}
