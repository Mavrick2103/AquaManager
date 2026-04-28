import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type TargetProfileKey =
  | 'FRESH_COMMUNITY'
  | 'FRESH_PLANTED'
  | 'FRESH_SHRIMP'
  | 'FRESH_CICHLID'
  | 'SALT_REEF'
  | 'SALT_FISH_ONLY'
  | 'CUSTOM';

export type ParamKey =
  // communs
  | 'ph'
  | 'temp'
  // eau douce
  | 'kh'
  | 'gh'
  | 'no2'
  | 'no3'
  | 'po4'
  | 'fe'
  | 'k'
  | 'sio2'
  | 'nh3'
  | 'co2'
  // eau de mer
  | 'dkh'
  | 'salinity'
  | 'ca'
  | 'mg';

export type TargetRange = { min?: number | null; max?: number | null };
export type TargetsJson = Partial<Record<ParamKey, TargetRange>>;

export interface AquariumTargetsDto {
  profileKey: TargetProfileKey;
  targets: TargetsJson | null;
}

export const ALL_PARAMS: ParamKey[] = [
  'ph',
  'temp',
  'no2',
  'no3',
  'nh3',

  'kh',
  'gh',
  'co2',
  'po4',
  'fe',
  'k',
  'sio2',

  'dkh',
  'salinity',
  'ca',
  'mg',
];

export const PARAM_LABELS: Record<ParamKey, string> = {
  ph: 'pH',
  temp: 'Température (°C)',
  no2: 'NO₂ (mg/L)',
  no3: 'NO₃ (mg/L)',
  nh3: 'NH₃ (mg/L)',

  kh: 'KH',
  gh: 'GH',
  co2: 'CO₂ (mg/L)',
  po4: 'PO₄ (mg/L)',
  fe: 'Fer Fe (mg/L)',
  k: 'Potassium K (mg/L)',
  sio2: 'Silicates SiO₂ (mg/L)',

  dkh: 'dKH',
  salinity: 'Salinité (ppt)',
  ca: 'Calcium Ca (mg/L)',
  mg: 'Magnésium Mg (mg/L)',
};

export const PROFILE_LABELS: Record<TargetProfileKey, string> = {
  FRESH_COMMUNITY: 'Eau douce - Communautaire',
  FRESH_PLANTED: 'Eau douce - Bac planté',
  FRESH_SHRIMP: 'Eau douce - Crevettes',
  FRESH_CICHLID: 'Eau douce - Cichlidés',
  SALT_REEF: 'Eau de mer - Récifal',
  SALT_FISH_ONLY: 'Eau de mer - Fish only',
  CUSTOM: 'Personnalisé',
};

@Injectable({ providedIn: 'root' })
export class AquariumTargetsService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getForAquarium(aquariumId: number) {
    const url = `${this.base}/aquariums/${aquariumId}/targets`;
    return firstValueFrom(this.http.get<AquariumTargetsDto>(url));
  }

  updateForAquarium(aquariumId: number, dto: Partial<AquariumTargetsDto>) {
    const url = `${this.base}/aquariums/${aquariumId}/targets`;
    return firstValueFrom(this.http.put<AquariumTargetsDto>(url, dto));
  }
}
