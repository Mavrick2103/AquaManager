import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AdminSidebarComponent } from '../../shared/admin-sidebar/admin-sidebar.component';
import { environment } from '../../../environments/environment';
interface Summary {
  segment: string;
  count: number;
  average: number | null;
  satisfied: number;
  premiumAverage: number | null;
  premiumCount: number;
  premiumSatisfied: number;
  [key: string]: any;
}
interface Review {
  id: number;
  userId: number;
  user: { fullName: string };
  segment: string;
  source: string;
  rating: number;
  premiumRating: number | null;
  comment: string;
  status: string;
  createdAt: string;
}
interface Report {
  totals: Summary[];
  monthly: (Summary & { month: string })[];
  items: Review[];
  total: number;
  page: number;
  pageSize: number;
}
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AdminSidebarComponent],
  templateUrl: './admin-satisfaction.component.html',
  styleUrl: './admin-satisfaction.component.scss',
})
export class AdminSatisfactionComponent implements OnInit {
  private http = inject(HttpClient);
  private url = environment.apiUrl + '/admin/satisfaction';
  data: Report | null = null;
  loading = false;
  error = '';
  saving: number | null = null;
  segment = '';
  source = 'CUSTOMER';
  days = '90';
  status = '';
  page = 1;
  readonly segments = ['CLASSIC', 'PREMIUM'];
  readonly stars = [5, 4, 3, 2, 1];
  private request = 0;
  ngOnInit() {
    void this.load();
  }
  async load(reset = false) {
    if (reset) this.page = 1;
    const version = ++this.request;
    this.loading = true;
    this.error = '';
    this.data = null;
    try {
      const data = await firstValueFrom(
        this.http.get<Report>(this.url, {
          params: {
            segment: this.segment,
            source: this.source,
            days: this.days,
            status: this.status,
            page: this.page,
          },
        }),
      );
      if (version === this.request) this.data = data;
    } catch {
      if (version === this.request) this.error = 'Impossible de charger les avis. Réessaie.';
    } finally {
      if (version === this.request) this.loading = false;
    }
  }
  summary(segment: string): Summary {
    return (
      this.data?.totals.find((r) => r.segment === segment) ?? {
        segment,
        count: 0,
        average: null,
        satisfied: 0,
        premiumAverage: null,
        premiumCount: 0,
        premiumSatisfied: 0,
      }
    );
  }
  percentage(count: number, total: number) {
    return Number(total) ? Math.round((Number(count) / Number(total)) * 100) : 0;
  }
  sourceLabel(value: string) {
    return (
      (
        {
          FREE: 'Classic',
          PAID: 'Premium payant',
          GIFT: 'Premium offert',
          STAFF: 'Équipe',
        } as Record<string, string>
      )[value] ?? value
    );
  }
  async review(item: Review, status: string) {
    this.saving = item.id;
    this.error = '';
    try {
      await firstValueFrom(this.http.patch(this.url + '/' + item.id, { status }));
      await this.load();
    } catch {
      this.error = 'Le statut n’a pas pu être enregistré.';
    } finally {
      this.saving = null;
    }
  }
  move(delta: number) {
    this.page += delta;
    void this.load();
  }
}
