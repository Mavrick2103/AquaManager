import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type Me = { userId: number; email: string; role: 'USER' | 'ADMIN' };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private accessToken: string | null = null; // token en mémoire
  me: Me | null = null;

  constructor(private http: HttpClient, private router: Router) {}

  get token(): string | null {
    return this.accessToken;
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
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
        { withCredentials: true } // pose le cookie httpOnly
      )
    );
    this.accessToken = res.access_token;
    await this.fetchMe();
    return this.router.navigateByUrl('/');
  }

  async refreshAccessToken(): Promise<string | null> {
    const res = await firstValueFrom(
      this.http.post<{ access_token: string | null }>(
        `${environment.apiUrl}/auth/refresh`,
        {},
        { withCredentials: true } // envoie le cookie httpOnly
      )
    );
    this.accessToken = res.access_token ?? null;
    return this.accessToken;
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
      this.http.get<Me>(`${environment.apiUrl}/users/me`, { headers: this.authHeaders })
    );
    this.me = me;
    return this.me;
  }

  logout() {
    this.accessToken = null;
    this.me = null;
    this.http.post(`${environment.apiUrl}/auth/logout`, {}, { withCredentials: true })
      .subscribe({ next: () => {}, error: () => {} });
    this.router.navigateByUrl('/login');
  }
}
