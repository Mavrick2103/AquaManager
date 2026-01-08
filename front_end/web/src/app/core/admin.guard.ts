import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  async canActivate(): Promise<boolean> {
    try {
      // AuthGuard a déjà refresh si besoin, mais on sécurise quand même
      if (!this.auth.isAuthenticated()) {
        const ok = await this.auth.refreshAccessToken();
        if (!ok) {
          this.router.navigateByUrl('/login');
          return false;
        }
      }

      if (!this.auth.me) {
        await this.auth.fetchMe();
      }

      if (this.auth.me?.role !== 'ADMIN') {
        this.router.navigateByUrl('/');
        return false;
      }

      return true;
    } catch {
      await this.auth.logout();
      return false;
    }
  }
}
