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
import { MatSelectModule } from '@angular/material/select';

import { AdminUsersApi, AdminUser, UserRole } from '../../../core/admin-users.service';

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
    MatSelectModule,
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

  displayedColumns = ['id', 'createdAt', 'fullName', 'email', 'role', 'status', 'actions'];

  // actif si activité < 30 jours (à toi d’ajuster)
  private readonly ACTIVE_MS = 30 * 24 * 60 * 60 * 1000;

  // ✅ options de rôle affichées
  readonly roleOptions: Array<{ value: UserRole; label: string; icon: string }> = [
    { value: 'USER', label: 'Utilisateur', icon: 'person' },
    { value: 'EDITOR', label: 'Éditeur', icon: 'edit' },
    { value: 'ADMIN', label: 'Admin', icon: 'admin_panel_settings' },
  ];

  // ✅ état “saving” par user id
  private readonly saving = new Set<number>();

  constructor(
    private readonly api: AdminUsersApi,
    private readonly location: Location,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.reload();

    // recharge côté API uniquement quand le search change
    this.searchCtrl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.reload());

    // filtres 100% front : ne rappelle pas l'API
    this.activeOnlyCtrl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.applyFilters());
    this.adminOnlyCtrl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.applyFilters());
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
    this.router.navigate(['/admin/users', u.id]);
  }

  formatDate(value: string | Date): string {
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

  reload(): void {
    const search = this.searchCtrl.value?.trim() || undefined;

    this.loading = true;
    this.api.list(search).subscribe({
      next: (rows) => {
        this.users = [...(rows ?? [])].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
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

  isSaving(u: AdminUser): boolean {
    return this.saving.has(u.id);
  }

  setRole(u: AdminUser, nextRole: UserRole): void {
    const prevRole = u.role;
    if (prevRole === nextRole) return;

    // optimiste : update UI direct
    this.users = this.users.map((x) => (x.id === u.id ? { ...x, role: nextRole } : x));
    this.applyFilters();

    this.saving.add(u.id);

    this.api.update(u.id, { role: nextRole }).subscribe({
      next: (updated) => {
        this.users = this.users.map((x) => (x.id === u.id ? { ...x, role: updated.role } : x));
        this.applyFilters();
        this.saving.delete(u.id);
      },
      error: () => {
        // revert si erreur
        this.users = this.users.map((x) => (x.id === u.id ? { ...x, role: prevRole } : x));
        this.applyFilters();
        this.saving.delete(u.id);
      },
    });
  }

  deleteUser(u: AdminUser): void {
    const ok = confirm(`Supprimer l’utilisateur "${u.fullName}" (${u.email}) ?`);
    if (!ok) return;

    this.saving.add(u.id);

    this.api.remove(u.id).subscribe({
      next: () => {
        this.users = this.users.filter((x) => x.id !== u.id);
        this.applyFilters();
        this.saving.delete(u.id);
      },
      error: () => {
        this.saving.delete(u.id);
      },
    });
  }

  trackById(_: number, u: AdminUser) {
    return u.id;
  }
}
