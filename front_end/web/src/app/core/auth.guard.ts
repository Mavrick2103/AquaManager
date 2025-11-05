import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  async canActivate(): Promise<boolean> {
    if (!this.auth.isAuthenticated()) {
      const ok = await this.auth.refreshAccessToken();
      if (!ok) {
        this.router.navigateByUrl('/login');
        return false;
      }
    }
    try {
      if (!this.auth.me) await this.auth.fetchMe();
      return true;
    } catch {
      this.auth.logout();
      return false;
    }
  }
}
