import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface WaterMeasurement {
  id: number;
  takenAt: string; // ISO
  ph?: number|null;
  kh?: number|null;
  gh?: number|null;
  co2?: number|null;
  k?: number|null;
  no2?: number|null;
  no3?: number|null;
  amn?: number|null;
  fe?: number|null;
  temp?: number|null;
  po4?: number|null;
  createdAt: string;
}

export interface CreateWaterMeasurementDto {
  takenAt: string;
  ph?: number; kh?: number; gh?: number; co2?: number; k?: number;
  no2?: number; no3?: number; amn?: number; fe?: number; temp?: number; po4?: number;
}

@Injectable({ providedIn: 'root' })
export class WaterService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/aquariums`;

  list(aquariumId: number, limit = 200): Observable<WaterMeasurement[]> {
    let params = new HttpParams().set('limit', String(limit));
    return this.http.get<WaterMeasurement[]>(`${this.base}/${aquariumId}/measurements`, { params });
  }

  create(aquariumId: number, dto: CreateWaterMeasurementDto): Observable<WaterMeasurement> {
    return this.http.post<WaterMeasurement>(`${this.base}/${aquariumId}/measurements`, dto);
  }
}
