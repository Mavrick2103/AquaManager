import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type Theme = 'system'|'light'|'dark';
export type DefaultView = 'cards'|'table';
export type TemperatureUnit = 'C'|'F';
export type VolumeUnit = 'L'|'GAL';

export interface UserSettings {
  theme: Theme;
  defaultView: DefaultView;
  temperatureUnit: TemperatureUnit;
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
  private base = environment.apiUrl;

  async getMySettings(): Promise<UserSettings | null> {
    return await firstValueFrom(this.http.get<UserSettings>(`${this.base}/settings`));
  }

  async updateMySettings(diff: Partial<UserSettings>) {
    return await firstValueFrom(this.http.put<UserSettings>(`${this.base}/settings`, diff));
  }
}
