// src/app/core/aquariums.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type WaterType = 'EAU_DOUCE' | 'EAU_DE_MER';

export interface Aquarium {
  id: number;
  name: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  volumeL: number;
  waterType: WaterType;
  startDate: string;
  createdAt: string;
}

export interface CreateAquariumDto {
  name: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  waterType: WaterType;
  startDate: string;
}

@Injectable({ providedIn: 'root' })
export class AquariumsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/aquariums`;

  list(): Observable<Aquarium[]> {
    return this.http.get<Aquarium[]>(this.base);
  }

  getById(id: number): Observable<Aquarium> {
    return this.http.get<Aquarium>(`${this.base}/${id}`);
  }

  create(dto: CreateAquariumDto): Observable<Aquarium> {
    return this.http.post<Aquarium>(this.base, dto);
  }

  update(id: number, dto: Partial<CreateAquariumDto>): Observable<Aquarium> {
    return this.http.put<Aquarium>(`${this.base}/${id}`, dto);
  }

  listMine() {
    return this.http.get<Aquarium[]>(this.base);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
