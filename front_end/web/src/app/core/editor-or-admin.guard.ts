import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { UserService } from './user.service';
import { AuthService } from './auth.service';

type AppRole = 'USER' | 'EDITOR' | 'ADMIN' | 'SUPERADMIN';

@Injectable({ providedIn: 'root' })
export class EditorOrAdminGuard implements CanActivate {
  constructor(
    private readonly users: UserService,
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  async canActivate(): Promise<boolean | UrlTree> {
    // 1) si pas connecté -> tente refresh
    if (!this.auth.isAuthenticated()) {
      const ok = await this.auth.refreshAccessToken();
      if (!ok) return this.router.parseUrl('/login');
    }

    // 2) récupère le rôle
    try {
      const me: any = await this.users.getMe();
      const role = String(me?.role ?? '').toUpperCase().trim() as AppRole;

      const ok = role === 'EDITOR' || role === 'ADMIN' || role === 'SUPERADMIN';
      return ok ? true : this.router.parseUrl('/');
    } catch {
      // 3) si getMe a planté (token expiré entre temps), on retente 1 refresh puis getMe
      const ok = await this.auth.refreshAccessToken();
      if (!ok) return this.router.parseUrl('/login');

      try {
        const me: any = await this.users.getMe();
        const role = String(me?.role ?? '').toUpperCase().trim() as AppRole;

        const ok2 = role === 'EDITOR' || role === 'ADMIN' || role === 'SUPERADMIN';
        return ok2 ? true : this.router.parseUrl('/');
      } catch {
        return this.router.parseUrl('/login');
      }
    }
  }
}
