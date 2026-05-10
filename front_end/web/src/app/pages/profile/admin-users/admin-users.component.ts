import { CommonModule, Location } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { Router, RouterModule } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatListModule } from '@angular/material/list';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatMenuModule } from '@angular/material/menu';

import {
  AdminUsersApi,
  AdminUser,
  GrantSubscriptionDuration,
  SubscriptionPlan,
  UserRole,
} from '../../../core/admin-users.service';

@Component({
  standalone: true,
  selector: 'app-admin-users',
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,

    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
    MatListModule,
    MatSlideToggleModule,
    MatMenuModule,
  ],
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  loading = false;

  users: AdminUser[] = [];
  filteredUsers: AdminUser[] = [];

  searchCtrl = new FormControl<string>('', { nonNullable: true });
  activeOnlyCtrl = new FormControl<boolean>(false, { nonNullable: true });
  adminOnlyCtrl = new FormControl<boolean>(false, { nonNullable: true });

  displayedColumns = [
    'id',
    'createdAt',
    'fullName',
    'email',
    'role',
    'subscription',
    'status',
    'actions',
  ];

  private readonly ACTIVE_MS = 30 * 24 * 60 * 60 * 1000;

  readonly roleOptions: Array<{ value: UserRole; label: string; icon: string }> = [
    { value: 'USER', label: 'Utilisateur', icon: 'person' },
    { value: 'EDITOR', label: 'Éditeur', icon: 'edit' },
    { value: 'ADMIN', label: 'Admin', icon: 'admin_panel_settings' },
  ];

  readonly grantOptions: Array<{
    label: string;
    plan: Exclude<SubscriptionPlan, 'CLASSIC'>;
    duration: GrantSubscriptionDuration;
    icon: string;
  }> = [
    { label: 'Premium 14 jours', plan: 'PREMIUM', duration: '14d', icon: 'star' },
    { label: 'Premium 1 mois', plan: 'PREMIUM', duration: '1m', icon: 'star' },
    { label: 'Premium 3 mois', plan: 'PREMIUM', duration: '3m', icon: 'star' },
    { label: 'Premium 6 mois', plan: 'PREMIUM', duration: '6m', icon: 'star' },
    { label: 'Premium 1 an', plan: 'PREMIUM', duration: '1y', icon: 'star' },
    { label: 'Premium à vie', plan: 'PREMIUM', duration: 'lifetime', icon: 'all_inclusive' },

    { label: 'Pro 1 mois', plan: 'PRO', duration: '1m', icon: 'workspace_premium' },
    { label: 'Pro 1 an', plan: 'PRO', duration: '1y', icon: 'workspace_premium' },
    { label: 'Pro à vie', plan: 'PRO', duration: 'lifetime', icon: 'all_inclusive' },
  ];

  private readonly saving = new Set<number>();
  private readonly savingSubscription = new Set<number>();

  constructor(
    private readonly api: AdminUsersApi,
    private readonly location: Location,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.reload();

    this.searchCtrl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.reload());

    this.activeOnlyCtrl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.applyFilters());

    this.adminOnlyCtrl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.applyFilters());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  back(): void {
    try {
      this.location.back();
    } catch {
      this.router.navigateByUrl('/profile');
    }
  }

  clearSearch(): void {
    this.searchCtrl.setValue('');
  }

  openUser(u: AdminUser): void {
    if (this.isSaving(u) || this.isSavingSubscription(u)) return;
    this.router.navigate(['/admin/users', u.id]);
  }

  reload(): void {
    const search = this.searchCtrl.value.trim() || undefined;

    this.loading = true;

    this.api.list(search).subscribe({
      next: (rows) => {
        this.users = [...(rows ?? [])].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );

        this.applyFilters();
        this.loading = false;
      },
      error: (error) => {
        console.error('Erreur chargement utilisateurs admin', error);
        this.users = [];
        this.filteredUsers = [];
        this.loading = false;
      },
    });
  }

  applyFilters(): void {
    const activeOnly = this.activeOnlyCtrl.value;
    const adminOnly = this.adminOnlyCtrl.value;

    this.filteredUsers = this.users.filter((u) => {
      if (activeOnly && !this.isActive(u)) return false;
      if (adminOnly && u.role !== 'ADMIN') return false;

      return true;
    });
  }

  formatDate(value: string | Date | null | undefined): string {
    if (!value) return '—';

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();

    return `${dd}/${mm}/${yyyy}`;
  }

  isActive(u: AdminUser): boolean {
    if (!u?.lastActivityAt) return false;

    const last = new Date(u.lastActivityAt).getTime();
    if (!Number.isFinite(last)) return false;

    return Date.now() - last <= this.ACTIVE_MS;
  }

  lastSeenLabel(u: AdminUser): string {
    if (!u?.lastActivityAt) return 'Jamais';

    const last = new Date(u.lastActivityAt).getTime();
    if (!Number.isFinite(last)) return 'Jamais';

    const diffMs = Date.now() - last;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin <= 0) return 'À l’instant';
    if (diffMin < 60) return `Il y a ${diffMin} min`;

    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Il y a ${diffH} h`;

    const diffD = Math.floor(diffH / 24);
    return `Il y a ${diffD} j`;
  }

  isSaving(u: AdminUser): boolean {
    return this.saving.has(u.id);
  }

  isSavingSubscription(u: AdminUser): boolean {
    return this.savingSubscription.has(u.id);
  }

  setRole(u: AdminUser, nextRole: UserRole): void {
    const prevRole = u.role;

    if (prevRole === nextRole) return;
    if (this.isSaving(u) || this.isSavingSubscription(u)) return;

    this.saving.add(u.id);

    this.users = this.users.map((x) =>
      x.id === u.id ? { ...x, role: nextRole } : x,
    );
    this.applyFilters();

    this.api.update(u.id, { role: nextRole }).subscribe({
      next: (updated) => {
        this.users = this.users.map((x) =>
          x.id === u.id ? { ...x, ...updated } : x,
        );

        this.applyFilters();
        this.saving.delete(u.id);
      },
      error: (error) => {
        console.error('Erreur modification rôle utilisateur', error);

        this.users = this.users.map((x) =>
          x.id === u.id ? { ...x, role: prevRole } : x,
        );

        this.applyFilters();
        this.saving.delete(u.id);
      },
    });
  }

  grantSubscription(
    u: AdminUser,
    plan: Exclude<SubscriptionPlan, 'CLASSIC'>,
    duration: GrantSubscriptionDuration,
  ): void {
    if (this.isSaving(u) || this.isSavingSubscription(u)) return;

    this.savingSubscription.add(u.id);

    this.api.grantSubscription(u.id, { plan, duration }).subscribe({
      next: (updated) => {
        this.users = this.users.map((x) =>
          x.id === u.id ? { ...x, ...updated } : x,
        );

        this.applyFilters();
        this.savingSubscription.delete(u.id);
      },
      error: (error) => {
        console.error('Erreur attribution abonnement', error);
        this.savingSubscription.delete(u.id);
      },
    });
  }

  revokeSubscription(u: AdminUser): void {
    if (this.isSaving(u) || this.isSavingSubscription(u)) return;

    const ok = confirm(`Retirer l'accès Premium/Pro de "${u.fullName || u.email}" ?`);
    if (!ok) return;

    this.savingSubscription.add(u.id);

    this.api.revokeSubscription(u.id).subscribe({
      next: (updated) => {
        this.users = this.users.map((x) =>
          x.id === u.id ? { ...x, ...updated } : x,
        );

        this.applyFilters();
        this.savingSubscription.delete(u.id);
      },
      error: (error) => {
        console.error('Erreur retrait abonnement', error);
        this.savingSubscription.delete(u.id);
      },
    });
  }

  subscriptionLabel(u: AdminUser): string {
    const plan = u.subscriptionPlan ?? 'CLASSIC';

    if (plan === 'PRO') return 'PRO';
    if (plan === 'PREMIUM') return 'PREMIUM';

    return 'CLASSIC';
  }

  subscriptionClass(u: AdminUser): string {
    const plan = u.subscriptionPlan ?? 'CLASSIC';

    if (plan === 'PRO') return 'pro';
    if (plan === 'PREMIUM') return 'premium';

    return 'classic';
  }

  subscriptionEndLabel(u: AdminUser): string {
    const plan = u.subscriptionPlan ?? 'CLASSIC';

    if (plan === 'CLASSIC') return 'Aucun accès payant';
    if (!u.subscriptionEndsAt) return 'Sans expiration';

    const end = new Date(u.subscriptionEndsAt);
    if (Number.isNaN(end.getTime())) return 'Expiration inconnue';

    if (end.getTime() < Date.now()) {
      return `Expiré le ${this.formatDate(end)}`;
    }

    return `Expire le ${this.formatDate(end)}`;
  }

  hasPaidPlan(u: AdminUser): boolean {
    return u.subscriptionPlan === 'PREMIUM' || u.subscriptionPlan === 'PRO';
  }

  deleteUser(u: AdminUser): void {
    if (this.isSaving(u) || this.isSavingSubscription(u)) return;

    const ok = confirm(`Supprimer l’utilisateur "${u.fullName || '—'}" (${u.email}) ?`);
    if (!ok) return;

    this.saving.add(u.id);

    this.api.remove(u.id).subscribe({
      next: () => {
        this.users = this.users.filter((x) => x.id !== u.id);
        this.applyFilters();
        this.saving.delete(u.id);
      },
      error: (error) => {
        console.error('Erreur suppression utilisateur', error);
        this.saving.delete(u.id);
      },
    });
  }

  trackById(_: number, u: AdminUser): number {
    return u.id;
  }
}