import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserMe {
  id: number;
  email: string;
  fullName: string;
}

export interface UpdateMeDto {
  email?: string;
  fullName?: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/users`;

  getMe() {
    return firstValueFrom(this.http.get<UserMe>(`${this.base}/me`));
  }

  updateMe(dto: UpdateMeDto) {
    // Ton back accepte PUT partiel -> on envoie juste le champ modifié
    return firstValueFrom(this.http.put<UserMe>(`${this.base}/me`, dto));
  }

  changePassword(dto: ChangePasswordDto) {
    return firstValueFrom(this.http.post(`${this.base}/me/password`, dto));
  }

  deleteMe() {
    return firstValueFrom(this.http.delete<void>(`${this.base}/me`));
  }
}
