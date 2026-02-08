import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { UserService } from './user.service';

type AppRole = 'USER' | 'EDITOR' | 'ADMIN' | 'SUPERADMIN';

@Injectable({ providedIn: 'root' })
export class EditorOrAdminGuard implements CanActivate {
  constructor(
    private readonly users: UserService,
    private readonly router: Router,
  ) {}

  async canActivate(): Promise<boolean | UrlTree> {
    try {
      const me: any = await this.users.getMe();
      const role = String(me?.role ?? '').toUpperCase() as AppRole;

      const ok = role === 'EDITOR' || role === 'ADMIN' || role === 'SUPERADMIN';
      return ok ? true : this.router.parseUrl('/');
    } catch {
      return this.router.parseUrl('/login');
    }
  }
}
