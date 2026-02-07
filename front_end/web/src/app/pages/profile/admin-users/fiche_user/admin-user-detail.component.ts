import { CommonModule, Location } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';

import { AdminUsersApi, AdminUserFull } from '../../../../core/admin-users.service';

@Component({
  standalone: true,
  selector: 'app-admin-user-detail',
  templateUrl: './admin-user-detail.component.html',
  styleUrls: ['./admin-user-detail.component.scss'],
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatTableModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUserDetailComponent implements OnInit {
  loading = true;
  data: AdminUserFull | null = null;
  userId = 0;

  aquariumsCols = ['id', 'name', 'waterType'];
  measuresCols = ['date', 'aquariumId', 'ph', 'temp', 'no2', 'no3'];
  tasksCols = ['id', 'title', 'status', 'dueAt', 'aquariumId'];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly api: AdminUsersApi,
    private readonly cdr: ChangeDetectorRef,
    private readonly location: Location,
    private readonly router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    this.userId = Number(this.route.snapshot.paramMap.get('id') || 0);
    if (!this.userId) {
      this.router.navigateByUrl('/admin/users');
      return;
    }
    await this.load();
  }

  back(): void {
    try {
      this.location.back();
    } catch {
      this.router.navigateByUrl('/admin/users');
    }
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  async load(): Promise<void> {
    this.loading = true;
    this.cdr.markForCheck();
    try {
      this.data = await firstValueFrom(this.api.getFull(this.userId));
    } catch (e) {
      console.error(e);
      this.data = null;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  get headerTitle(): string {
    const u = this.data?.user;
    if (!u) return `Utilisateur #${this.userId}`;
    return `${u.fullName || '—'} (ID ${u.id})`;
  }

  get headerSub(): string {
    const u = this.data?.user;
    if (!u) return '';
    return `${u.email} • inscrit le ${this.formatDate(u.createdAt)} • rôle ${u.role}`;
  }
}
