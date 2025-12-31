import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type Me = {
  userId: number;
  email: string;
  role: 'USER' | 'ADMIN';
  fullName?: string;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private accessToken: string | null = null;
  me: Me | null = null;

  constructor(private http: HttpClient, private router: Router) {}

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

  async login(email: string, password: string) {
    const res = await firstValueFrom(
      this.http.post<{ access_token: string }>(
        `${environment.apiUrl}/auth/login`,
        { email, password },
        { withCredentials: true } // cookie refresh httpOnly
      )
    );

    this.accessToken = res.access_token;
    await this.fetchMe();
    return this.router.navigateByUrl('/');
  }

  async refreshAccessToken(): Promise<string | null> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ access_token: string | null }>(
          `${environment.apiUrl}/auth/refresh`,
          {},
          { withCredentials: true }
        )
      );

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

  async register(payload: { fullName: string; email: string; password: string }) {
    return await firstValueFrom(
      this.http.post<{ message: string }>(
        `${environment.apiUrl}/auth/register`,
        payload
      )
    );
  }

  async fetchMe() {
    const me = await firstValueFrom(
      this.http.get<Me>(`${environment.apiUrl}/users/me`, {
        headers: this.authHeaders,
      })
    );
    this.me = me;
    return this.me;
  }

  async logout() {
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
