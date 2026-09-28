import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  async canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean | UrlTree> {
    if (!this.auth.isAuthenticated()) {
      const ok = await this.auth.refreshAccessToken();
      if (!ok) {
        return this.router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
      }
    }

    try {
      if (!this.auth.me) {
        await this.auth.fetchMe(state.url !== '/profile?tab=subscription');
      }
      return true;
    } catch {
      await this.auth.logout();
      return false;
    }
  }
}
