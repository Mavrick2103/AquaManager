import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type Me = { userId: number; email: string; role: 'USER' | 'ADMIN' };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private tokenKey = 'token';
  me: Me | null = null;

  constructor(private http: HttpClient, private router: Router) {}

  get token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }
  setToken(token: string) {
    localStorage.setItem(this.tokenKey, token);
  }
  isAuthenticated(): boolean {
    return !!this.token;
  }
  private get authHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.token ?? ''}`,
    });
  }

  async login(email: string, password: string) {
  const res = await this.http.post<{ access_token: string }>(
    `${environment.apiUrl}/auth/login`,
    { email, password }
  ).toPromise();

  localStorage.setItem(this.tokenKey, res!.access_token);
  await this.fetchMe();// voir pour changer le stockage localStorage/ httpOnly ou variable javascript

  return this.router.navigateByUrl('/');
}


  async register(payload: { fullName: string; email: string; password: string }) {
    const res = await firstValueFrom(
      this.http.post<{ message: string }>(
        `${environment.apiUrl}/auth/register`,
        payload
      )
    );
    return res;
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

  logout() {
    localStorage.removeItem(this.tokenKey);
    this.me = null;
    this.router.navigateByUrl('/login');
  }
}
