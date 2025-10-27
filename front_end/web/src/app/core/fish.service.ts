import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

export type WaterType = 'EAU_DOUCE'|'EAU_DE_MER';
export type SwimmingArea = 'TOP'|'MID'|'BOTTOM';
export type Temperament = 'PEACEFUL'|'SEMI_AGGRESSIVE'|'AGGRESSIVE';
export type DifficultyLevel = 'EASY'|'MEDIUM'|'HARD';

export interface Fish {
  id: number;
  scientificName: string;
  commonName: string;
  origin?: string | null;
  waterType: WaterType;
  sizeMin?: number | null; sizeMax?: number | null;
  lifeExpectancy?: number | null;
  phMin?: number | null; phMax?: number | null;
  ghMin?: number | null; ghMax?: number | null;
  khMin?: number | null; khMax?: number | null;
  temperatureMin?: number | null; temperatureMax?: number | null;
  volumeMin?: number | null;
  swimmingArea?: SwimmingArea | null;
  groupMin?: number | null;
  temperament: Temperament;
  compatibility?: string | null;
  difficultyLevel: DifficultyLevel;
  note?: string | null;
  createdAt?: string; updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class FishService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/catalog/fish`;

  list(q?: string): Observable<Fish[]> {
    const params = q ? new HttpParams().set('q', q) : undefined as any;
    return this.http.get<Fish[]>(this.base, { params });
  }
  get(id: number) { return this.http.get<Fish>(`${this.base}/${id}`); }
  create(dto: Partial<Fish>) { return this.http.post<Fish>(this.base, dto); } // admin
  update(id: number, dto: Partial<Fish>) { return this.http.patch<Fish>(`${this.base}/${id}`, dto); } // admin
  remove(id: number) { return this.http.delete(`${this.base}/${id}`); } // admin
}
