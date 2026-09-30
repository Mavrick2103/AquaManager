import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { SiteTourService } from './site-tour.service';

export type Me = {
  id: number;
  email: string;
  role: 'USER' | 'EDITOR' | 'ADMIN';
  fullName?: string;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private refreshInFlight: Promise<string | null> | null = null;
  private sessionEpoch = 0;
  private accessToken: string | null = null;
  me: Me | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    private siteTour: SiteTourService,
  ) {}

  get token(): string | null {
    return this.accessToken;
  }

  isAuthenticated(): boolean {
    if (!this.accessToken) return false;

    try {
      const parts = this.accessToken.split('.');
      if (parts.length !== 3) return false;

      const payloadJson = atob(parts[1]);
      const payload = JSON.parse(payloadJson) as { exp?: number };

      if (!payload.exp) {
        return true;
      }

      const nowMs = Date.now();
      const expMs = payload.exp * 1000;
      return nowMs < expMs;
    } catch {
      return false;
    }
  }

  private get authHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.accessToken ?? ''}`,
    });
  }

  async login(email: string, password: string, destination = '/dashboard') {
    const res = await firstValueFrom(
      this.http.post<{ access_token: string }>(
        `${environment.apiUrl}/auth/login`,
        { email, password },
        { withCredentials: true } // cookie refresh httpOnly
      )
    );

    this.accessToken = res.access_token;
    await this.fetchMe(destination !== '/profile?tab=subscription');
    // Only the subscription destination is accepted from the public login URL.
    return this.router.navigateByUrl(destination === '/profile?tab=subscription' ? destination : '/dashboard');
  }

  refreshAccessToken(): Promise<string | null> {
    if (!this.refreshInFlight) {
      const epoch = this.sessionEpoch;
      const run = () => epoch === this.sessionEpoch ? this.performRefresh(epoch) : Promise.resolve(null);
      const request = typeof navigator !== 'undefined' && navigator.locks
        ? navigator.locks.request('aquamanager-refresh', run)
        : run();
      this.refreshInFlight = Promise.resolve(request).finally(() => { this.refreshInFlight = null; });
    }
    return this.refreshInFlight;
  }

  private async performRefresh(epoch: number): Promise<string | null> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ access_token: string | null }>(
          `${environment.apiUrl}/auth/refresh`,
          {},
          { withCredentials: true }
        )
      );

      if (epoch !== this.sessionEpoch) return null;
      if (!res.access_token) {
        this.accessToken = null;
        this.me = null;
        return null;
      }

      this.accessToken = res.access_token;
      return this.accessToken;
    } catch {
      this.accessToken = null;
      this.me = null;
      return null;
    }
  }
  
  async verifyEmail(token: string): Promise<{ ok: boolean; message?: string; access_token?: string | null }> {
  return await firstValueFrom(
    this.http.post<{ ok: boolean; message?: string; access_token?: string | null }>(
      `${environment.apiUrl}/auth/verify-email`,
      { token },
      { withCredentials: true }
    )
  );
}

async completeVerifyLogin(accessToken: string) {
  this.accessToken = accessToken;
  await this.fetchMe();
  return this.router.navigateByUrl('/dashboard');
}

async forgotPassword(email: string): Promise<{ ok: boolean; message?: string }> {
  return await this.http
    .post<{ ok: boolean; message?: string }>(`${environment.apiUrl}/auth/forgot-password`, { email })
    .toPromise() as any;
}

async resetPassword(token: string, newPassword: string): Promise<{ ok: boolean; message?: string }> {
  return await this.http
    .post<{ ok: boolean; message?: string }>(`${environment.apiUrl}/auth/reset-password`, { token, newPassword })
    .toPromise() as any;
}


  async resendVerification(email: string) {
    return firstValueFrom(this.http.post<{ message: string }>(
      environment.apiUrl + '/auth/resend-verification', { email },
    ));
  }

  async register(payload: { fullName: string; email: string; password: string; notificationPreferences?: { taskReminders: boolean; automaticNotifications: boolean; newsAndUpdates: boolean } }) {
    return await firstValueFrom(
      this.http.post<{ message: string }>(
        `${environment.apiUrl}/auth/register`,
        payload
      )
    );
  }

  async fetchMe(offerTour = true) {
    const me = await firstValueFrom(
      this.http.get<Me>(`${environment.apiUrl}/users/me`, {
        headers: this.authHeaders,
      })
    );
    this.me = me;
    if (offerTour) this.siteTour.offerForUser(Number(me.id));
    return this.me;
  }

  async logout() {
    this.sessionEpoch++;
    this.accessToken = null;
    this.me = null;

    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiUrl}/auth/logout`,
          {},
          { withCredentials: true }
        )
      );
    } catch {
    } finally {
      this.router.navigateByUrl('/login');
    }
  }
}
