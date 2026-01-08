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

import { AdminUsersApi, AdminUser } from '../../../core/admin-users.service';

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
  ],
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  loading = false;
  users: AdminUser[] = [];
  searchCtrl = new FormControl<string>('', { nonNullable: true });

  displayedColumns = ['createdAt', 'fullName', 'email', 'role', 'actions'];

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
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  back(): void {
    // ✅ Retour “comme les autres pages”
    try {
      this.location.back();
    } catch {
      this.router.navigateByUrl('/profile');
    }
  }

  clearSearch(): void {
    this.searchCtrl.setValue('');
  }

  reload(): void {
    const search = this.searchCtrl.value?.trim() || undefined;

    this.loading = true;
    this.api.list(search).subscribe({
      next: (rows) => {
        this.users = [...rows].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  toggleRole(u: AdminUser): void {
    const nextRole: AdminUser['role'] = u.role === 'ADMIN' ? 'USER' : 'ADMIN';

    this.api.update(u.id, { role: nextRole }).subscribe({
      next: (updated) => {
        this.users = this.users.map((x) =>
          x.id === u.id ? { ...x, role: updated.role } : x,
        );
      },
      error: () => {
        // on ne fait rien
      },
    });
  }

  deleteUser(u: AdminUser): void {
    const ok = confirm(`Supprimer l’utilisateur "${u.fullName}" (${u.email}) ?`);
    if (!ok) return;

    this.api.remove(u.id).subscribe({
      next: () => {
        this.users = this.users.filter((x) => x.id !== u.id);
      },
      error: () => {},
    });
  }

  trackById(_: number, u: AdminUser) {
    return u.id;
  }
}
