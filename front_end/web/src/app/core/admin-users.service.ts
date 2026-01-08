import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type AdminUser = {
  id: number;
  fullName: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  emailVerifiedAt: string | null;
};

export type UpdateAdminUserDto = Partial<Pick<AdminUser, 'fullName' | 'email' | 'role'>>;

@Injectable({ providedIn: 'root' })
export class AdminUsersApi {
  private readonly baseUrl = environment.apiUrl; // ex: http://localhost:3000/api

  constructor(private readonly http: HttpClient) {}

  list(search?: string): Observable<AdminUser[]> {
    let params = new HttpParams();
    if (search?.trim()) params = params.set('search', search.trim());

    return this.http.get<AdminUser[]>(`${this.baseUrl}/admin/users`, {
      params,
      withCredentials: true,
    });
  }

  update(id: number, dto: UpdateAdminUserDto): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.baseUrl}/admin/users/${id}`, dto, {
      withCredentials: true,
    });
  }

  remove(id: number): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${this.baseUrl}/admin/users/${id}`, {
      withCredentials: true,
    });
  }
}
