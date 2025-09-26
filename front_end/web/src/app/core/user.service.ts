import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

export interface UserMe {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
}

export interface UpdateMeDto {
  email?: string;
  firstName?: string;
  lastName?: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/users`;

  me(): Observable<UserMe> {
    return this.http.get<UserMe>(`${this.base}/me`);
  }

  updateMe(dto: UpdateMeDto): Observable<UserMe> {
    return this.http.put<UserMe>(`${this.base}/me`, dto);
  }

  changePassword(dto: ChangePasswordDto): Observable<void> {
    return this.http.post<void>(`${this.base}/me/password`, dto);
  }
}

