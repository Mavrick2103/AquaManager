import { CommonModule, Location } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

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

import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';

import {
  AdminUsersApi,
  AdminUser,
  GrantSubscriptionDuration,
  SubscriptionPlan,
  UserRole,
} from '../../../core/admin-users.service';
import { AdminSidebarComponent } from '../../../shared/admin-sidebar/admin-sidebar.component';

type UserSortMode = 'createdAt_desc' | 'level_desc' | 'activityDays_desc' | 'lastActivity_desc';

@Component({
  standalone: true,
  selector: 'app-admin-users',
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    AdminSidebarComponent,
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

    MatSelectModule,
    MatMenuModule,
  ],
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  loading = false;
  loadError = '';
  registrationDaysCtrl = new FormControl<number>(0, { nonNullable: true });
  private loadSequence = 0;

  users: AdminUser[] = [];
  filteredUsers: AdminUser[] = [];

  get verifiedUsersCount(): number {
    return this.users.filter((user) => Boolean(user.emailVerifiedAt)).length;
  }

  get subscribedUsersCount(): number {
    return this.users.filter((user) => this.isSubscribed(user)).length;
  }

  get privilegedUsersCount(): number {
    return this.users.filter((user) => user.role === 'ADMIN' || user.role === 'EDITOR').length;
  }

  searchCtrl = new FormControl<string>('', { nonNullable: true });
  sortCtrl = new FormControl<UserSortMode>('createdAt_desc', { nonNullable: true });

  roleFilter = new FormControl('all', { nonNullable: true });
  planFilter = new FormControl('all', { nonNullable: true });
  verificationFilter = new FormControl('all', { nonNullable: true });
  activityFilter = new FormControl('all', { nonNullable: true });

  get activeFilters(): Array<{ key: string; label: string; clear: () => void }> {
    const filters: Array<{ key: string; label: string; clear: () => void }> = [];
    if (this.searchCtrl.value.trim())
      filters.push({
        key: 'search',
        label: 'Recherche : ' + this.searchCtrl.value.trim(),
        clear: () => this.clearSearch(),
      });
    if (this.registrationDaysCtrl.value)
      filters.push({
        key: 'registration',
        label:
          'Inscription : ' +
          (this.registrationDaysCtrl.value === 1
            ? '24 heures'
            : this.registrationDaysCtrl.value + ' jours'),
        clear: () => this.registrationDaysCtrl.setValue(0),
      });
    const entries: Array<{key:string; control:FormControl<string>; labels:Record<string,string>}> = [
      {
        key: 'role',
        control: this.roleFilter,
        labels: {
          USER: 'Rôle : utilisateur',
          EDITOR: 'Rôle : éditeur',
          ADMIN: 'Rôle : administrateur',
        },
      },
      {
        key: 'plan',
        control: this.planFilter,
        labels: { active: 'Accès Premium / Pro actif', classic: 'Sans Premium / Pro actif' },
      },
      {
        key: 'verification',
        control: this.verificationFilter,
        labels: { verified: 'Email vérifié', pending: 'Email à confirmer' },
      },
      {
        key: 'activity',
        control: this.activityFilter,
        labels: {
          active: 'Actif depuis moins de 30 jours',
          inactive: 'Inactif depuis 30 jours ou jamais connecté',
        },
      },
    ];
    for (const entry of entries)
      if (entry.control.value !== 'all')
        filters.push({
          key: entry.key,
          label: entry.labels[entry.control.value],
          clear: () => entry.control.setValue('all'),
        });
    return filters;
  }
  get hasFilters(): boolean {
    return this.activeFilters.length > 0;
  }

  displayedColumns = ['fullName', 'createdAt', 'role', 'subscription', 'status', 'actions'];

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
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.verificationFilter.setValue(
      this.route.snapshot.queryParamMap.get('filter') === 'unverified' ? 'pending' : 'all',
      { emitEvent: false },
    );
    this.reload();
    this.searchCtrl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.reload());
    for (const control of ([
      this.registrationDaysCtrl,
      this.roleFilter,
      this.planFilter,
      this.verificationFilter,
      this.activityFilter,
      this.sortCtrl,
    ] as AbstractControl[])) {
      control.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.applyFilters());
    }
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

  resetFilters(): void {
    const hadSearch = !!this.searchCtrl.value.trim();
    this.searchCtrl.setValue('', { emitEvent: false });
    this.registrationDaysCtrl.setValue(0, { emitEvent: false });
    for (const control of [
      this.roleFilter,
      this.planFilter,
      this.verificationFilter,
      this.activityFilter,
    ])
      control.setValue('all', { emitEvent: false });
    this.sortCtrl.setValue('createdAt_desc', { emitEvent: false });
    if (hadSearch) this.reload();
    else this.applyFilters();
  }

  openUser(u: AdminUser): void {
    if (this.isSaving(u) || this.isSavingSubscription(u)) return;
    this.router.navigate(['/admin/users', u.id]);
  }

  reload(): void {
    const sequence = ++this.loadSequence;
    this.loadError = '';
    const search = this.searchCtrl.value.trim() || undefined;

    this.loading = true;

    this.api.list(search).subscribe({
      next: (rows) => {
        if (sequence !== this.loadSequence) return;
        this.users = [...(rows ?? [])].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );

        this.applyFilters();
        this.loading = false;
      },
      error: (error) => {
        if (sequence !== this.loadSequence) return;
        this.loadError = 'Impossible de charger les comptes. Réessayez avec le bouton Actualiser.';
        console.error('Erreur chargement utilisateurs admin', error);
        this.users = [];
        this.filteredUsers = [];
        this.loading = false;
      },
    });
  }

  applyFilters(): void {
    const sortMode = this.sortCtrl.value;
    let rows = this.users.filter((u) => {
      if (
        this.registrationDaysCtrl.value &&
        Date.parse(u.createdAt) < Date.now() - this.registrationDaysCtrl.value * 86400000
      )
        return false;
      if (this.roleFilter.value !== 'all' && u.role !== this.roleFilter.value) return false;
      if (this.planFilter.value === 'active' && !this.isSubscribed(u)) return false;
      if (this.planFilter.value === 'classic' && this.isSubscribed(u)) return false;
      if (this.verificationFilter.value === 'verified' && !u.emailVerifiedAt) return false;
      if (this.verificationFilter.value === 'pending' && u.emailVerifiedAt) return false;
      if (this.activityFilter.value === 'active' && !this.isActive(u)) return false;
      if (this.activityFilter.value === 'inactive' && this.isActive(u)) return false;
      return true;
    });

    rows = [...rows].sort((a, b) => {
      if (sortMode === 'level_desc') {
        return this.userLevel(b) - this.userLevel(a);
      }

      if (sortMode === 'activityDays_desc') {
        return this.userActivityDaysMonth(b) - this.userActivityDaysMonth(a);
      }

      if (sortMode === 'lastActivity_desc') {
        return this.userLastActivityTime(b) - this.userLastActivityTime(a);
      }

      return this.userCreatedTime(b) - this.userCreatedTime(a);
    });

    this.filteredUsers = rows;
  }

  userLevel(u: AdminUser): number {
    return Number(
      (u as any).level ??
        (u as any).gamification?.level ??
        (u as any).gamificationProfile?.level ??
        (u as any).profile?.level ??
        0,
    );
  }

  userActivityDaysMonth(u: AdminUser): number {
    return Number(
      (u as any).currentStreak ??
        (u as any).gamification?.currentStreak ??
        (u as any).gamificationProfile?.currentStreak ??
        (u as any).profile?.currentStreak ??
        0,
    );
  }

  userLastActivityTime(u: AdminUser): number {
    if (!u.lastActivityAt) return 0;

    const d = new Date(u.lastActivityAt).getTime();
    return Number.isFinite(d) ? d : 0;
  }

  userCreatedTime(u: AdminUser): number {
    if (!u.createdAt) return 0;

    const d = new Date(u.createdAt).getTime();
    return Number.isFinite(d) ? d : 0;
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

    this.users = this.users.map((x) => (x.id === u.id ? { ...x, role: nextRole } : x));
    this.applyFilters();

    this.api.update(u.id, { role: nextRole }).subscribe({
      next: (updated) => {
        this.users = this.users.map((x) => (x.id === u.id ? { ...x, ...updated } : x));

        this.applyFilters();
        this.saving.delete(u.id);
      },
      error: (error) => {
        console.error('Erreur modification rôle utilisateur', error);

        this.users = this.users.map((x) => (x.id === u.id ? { ...x, role: prevRole } : x));

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
        this.users = this.users.map((x) => (x.id === u.id ? { ...x, ...updated } : x));

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
        this.users = this.users.map((x) => (x.id === u.id ? { ...x, ...updated } : x));

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

  isSubscribed(u: AdminUser): boolean {
    const plan = u.subscriptionPlan ?? 'CLASSIC';

    if (plan !== 'PREMIUM' && plan !== 'PRO') {
      return false;
    }

    const status = u.subscriptionStatus ?? 'none';

    if (status !== 'active' && status !== 'trialing') {
      return false;
    }

    if (!u.subscriptionEndsAt) {
      return true; // abonnement à vie / sans expiration
    }

    const end = new Date(u.subscriptionEndsAt).getTime();

    if (!Number.isFinite(end)) {
      return false;
    }

    return end > Date.now();
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
