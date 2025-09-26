import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

export interface AppSettings {
  unit: 'metric'|'imperial';
  theme: 'light'|'dark'|'system';
  language: 'fr'|'en';
  notifications: boolean;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/settings`;

  get(): Observable<AppSettings> {
    return this.http.get<AppSettings>(this.base);
  }
  update(dto: Partial<AppSettings>): Observable<AppSettings> {
    return this.http.put<AppSettings>(this.base, dto);
  }
}
