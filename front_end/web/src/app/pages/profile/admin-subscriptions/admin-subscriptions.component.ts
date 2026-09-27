import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AdminSidebarComponent } from '../../../shared/admin-sidebar/admin-sidebar.component';
import { environment } from '../../../../environments/environment';

interface Subscription {
  id: string; userId: number; paypalId: string | null; environment: string; status: string;
  paidUntil: string | null; syncedAt: string | null; createdAt: string; current: boolean; canRefresh: boolean;
  user: { id: number; email: string; fullName: string; plan: string; status: string; endsAt: string | null; provider: string | null } | null;
}
interface Detail extends Subscription {
  payments: { id: string; paidAt: string | null; periodEnd: string | null; reversed: boolean; amount: string | null; currency: string; emailStatus: string; emailSentAt: string | null }[];
  paymentCount: number; actionCount: number;
  actions: { id: number; actorId: number; outcome: string; createdAt: string }[];
}
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatButtonModule, MatIconModule, AdminSidebarComponent],
  templateUrl: './admin-subscriptions.component.html', styleUrl: './admin-subscriptions.component.scss',
})
export class AdminSubscriptionsComponent implements OnInit {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/subscriptions`;
  items = signal<Subscription[]>([]); detail = signal<Detail | null>(null);
  loading = signal(false); detailLoading = signal(false); refreshing = signal(false);
  error = signal(''); notice = signal(''); total = signal(0); configuredEnvironment = signal('');
  search = ''; mode = 'all'; attention = false; page = 1;
  private selection = 0;
  ngOnInit() { void this.load(); }
  async load(reset = false) {
    if (this.loading()) return;
    if (reset) this.page = 1;
    this.loading.set(true); this.error.set('');
    try {
      const data = await firstValueFrom(this.http.get<{ items: Subscription[]; total: number; configuredEnvironment: string }>(this.base,
        { params: { search: this.search, environment: this.mode, attention: String(this.attention), page: this.page } }));
      this.items.set(data.items); this.total.set(data.total); this.configuredEnvironment.set(data.configuredEnvironment);
    } catch { this.error.set('Impossible de charger les abonnements. Réessaie dans un instant.'); }
    finally { this.loading.set(false); }
  }
  async open(item: Subscription) {
    if (this.refreshing()) return;
    const selection = ++this.selection;
    this.detail.set(null); this.detailLoading.set(true); this.notice.set(''); this.error.set('');
    try {
      const data = await firstValueFrom(this.http.get<Detail>(`${this.base}/${item.id}`));
      if (selection === this.selection) this.detail.set(data);
    } catch { if (selection === this.selection) this.error.set('Impossible de charger le détail.'); }
    finally { if (selection === this.selection) this.detailLoading.set(false); }
  }
  close() { if (this.refreshing()) return; this.selection++; this.detail.set(null); this.detailLoading.set(false); }
  async refresh() {
    const selected = this.detail();
    if (!selected?.canRefresh || this.refreshing()) return;
    this.refreshing.set(true); this.notice.set(''); this.error.set('');
    try {
      this.detail.set(await firstValueFrom(this.http.post<Detail>(`${this.base}/${selected.id}/refresh`, {})));
      this.notice.set('Vérification terminée. Les droits reflètent les paiements confirmés.');
      await this.load();
    } catch {
      this.error.set('Vérification impossible. La tentative est enregistrée dans l’historique.');
      try { this.detail.set(await firstValueFrom(this.http.get<Detail>(`${this.base}/${selected.id}`))); } catch { /* keep last visible state */ }
    } finally { this.refreshing.set(false); }
  }
  next(delta: number) { this.page += delta; void this.load(); }
  label(status: string) {
    return ({ CREATING: 'Création en cours', APPROVAL_PENDING: 'Validation attendue', APPROVED: 'Paiement attendu', ACTIVE: 'Actif', SUSPENDED: 'Suspendu', CANCELLED: 'Résilié', EXPIRED: 'Expiré',
      SENT: 'Envoyé', CHECK: 'Envoi à vérifier', PENDING: 'En attente', NOT_APPLICABLE: 'Sans objet', STARTED: 'Vérification commencée', SUCCESS: 'Vérification réussie', FAILED: 'Échec de vérification' } as Record<string, string>)[status] ?? status;
  }
}
