import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export type Theme = 'system' | 'light' | 'dark';
export type DefaultView = 'cards' | 'table';
export type TempUnit = 'C' | 'F';
export type VolumeUnit = 'L' | 'GAL';

export interface UserSettings {
  theme: Theme;
  defaultView: DefaultView;
  temperatureUnit: TempUnit;
  volumeUnit: VolumeUnit;
  emailNotifications: boolean;
  pushNotifications: boolean;
  alertsEnabled: boolean;
  phMin: number;
  phMax: number;
  tempMin: number;
  tempMax: number;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/settings`;

  getMySettings() {
    return this.http.get<UserSettings>(`${this.base}/me`).toPromise();
  }

  updateMySettings(dto: Partial<UserSettings>) {
    return this.http.patch<void>(`${this.base}/me`, dto).toPromise();
  }
}
