import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

export type LightLevel = 'LOW'|'MEDIUM'|'HIGH';
export type DifficultyLevel = 'EASY'|'MEDIUM'|'HARD';

export interface Plant {
  id: number;
  scientificName: string;
  commonName: string;
  origin?: string | null;
  phMin?: number | null; phMax?: number | null;
  ghMin?: number | null; ghMax?: number | null;
  khMin?: number | null; khMax?: number | null;
  temperatureMin?: number | null; temperatureMax?: number | null;
  heightMax?: number | null;
  placement?: string | null;
  difficultyLevel: DifficultyLevel;
  lightLevel: LightLevel;
  co2: boolean;
  substrat?: string | null;
  growthSpeed?: string | null;
  note?: string | null;
  createdAt?: string; updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class PlantsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/catalog/plants`;

  list(q?: string): Observable<Plant[]> {
    const params = q ? new HttpParams().set('q', q) : undefined as any;
    return this.http.get<Plant[]>(this.base, { params });
  }
  get(id: number) { return this.http.get<Plant>(`${this.base}/${id}`); }
  create(dto: Partial<Plant>) { return this.http.post<Plant>(this.base, dto); } // admin
  update(id: number, dto: Partial<Plant>) { return this.http.patch<Plant>(`${this.base}/${id}`, dto); } // admin
  remove(id: number) { return this.http.delete(`${this.base}/${id}`); } // admin
}
