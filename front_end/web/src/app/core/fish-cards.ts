import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type WaterType = 'EAU_DOUCE' | 'EAU_DE_MER' | 'SAUMATRE';
export type Temperament = 'PACIFIQUE' | 'SEMI_AGRESSIF' | 'AGRESSIF';
export type Activity = 'DIURNE' | 'NOCTURNE' | 'CREPUSCULAIRE';
export type Difficulty = 'FACILE' | 'MOYEN' | 'DIFFICILE';
export type ModerationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface FishCard {
  id: number;

  commonName: string;
  scientificName: string | null;
  family: string | null;
  origin: string | null;
  waterType: WaterType;

  tempMin: number | null;
  tempMax: number | null;
  phMin: number | null;
  phMax: number | null;
  ghMin: number | null;
  ghMax: number | null;
  khMin: number | null;
  khMax: number | null;

  minVolumeL: number | null;
  minGroupSize: number | null;
  maxSizeCm: number | null;
  lifespanYears: number | null;

  activity: Activity | null;
  temperament: Temperament | null;
  zone: string | null;
  diet: string | null;
  compatibility: string | null;
  difficulty: Difficulty | null;

  behavior: string | null;
  breeding: string | null;
  breedingTips: string | null;
  notes: string | null;

  imageUrl: string | null;

  isActive: boolean;

  status: ModerationStatus;
  rejectReason: string | null;

  createdById: number | null;
  updatedById: number | null;
  reviewedById: number | null;
  reviewedAt: string | null;

  createdAt: string;
  updatedAt: string | null;
}

export type CreateFishCardDto = {
  commonName: string;
  waterType: WaterType;

  scientificName?: string | null;
  family?: string | null;
  origin?: string | null;

  tempMin?: number | null;
  tempMax?: number | null;
  phMin?: number | null;
  phMax?: number | null;
  ghMin?: number | null;
  ghMax?: number | null;
  khMin?: number | null;
  khMax?: number | null;

  minVolumeL?: number | null;
  minGroupSize?: number | null;
  maxSizeCm?: number | null;
  lifespanYears?: number | null;

  activity?: Activity | null;
  temperament?: Temperament | null;
  zone?: string | null;
  diet?: string | null;
  compatibility?: string | null;
  difficulty?: Difficulty | null;

  behavior?: string | null;
  breeding?: string | null;
  breedingTips?: string | null;
  notes?: string | null;

  imageUrl?: string | null;
  isActive?: boolean;
};

export type UpdateFishCardDto = Partial<
  Omit<CreateFishCardDto, 'commonName' | 'waterType'> & {
    commonName: string;
    waterType: WaterType;
    imageUrl: string | null;
  }
>;

@Injectable({ providedIn: 'root' })
export class FishCardsApi {
  private readonly baseUrl = environment.apiUrl; // ex: http://localhost:3000/api

  constructor(private readonly http: HttpClient) {}

  // ---------- ADMIN ----------
  listAdmin(search?: string): Observable<FishCard[]> {
    let params = new HttpParams();
    if (search?.trim()) params = params.set('search', search.trim());
    return this.http.get<FishCard[]>(`${this.baseUrl}/admin/fish-cards`, { params, withCredentials: true });
  }

  createAdminWithImage(dto: CreateFishCardDto, file?: File): Observable<FishCard> {
    const fd = new FormData();
    for (const [k, v] of Object.entries(dto)) {
      if (v === undefined || v === null || v === '') continue;
      fd.append(k, String(v));
    }
    if (file) fd.append('file', file);

    return this.http.post<FishCard>(`${this.baseUrl}/admin/fish-cards`, fd, { withCredentials: true });
  }

  updateAdmin(id: number, dto: UpdateFishCardDto): Observable<FishCard> {
    return this.http.patch<FishCard>(`${this.baseUrl}/admin/fish-cards/${id}`, dto, { withCredentials: true });
  }

  removeAdmin(id: number): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${this.baseUrl}/admin/fish-cards/${id}`, { withCredentials: true });
  }

  approve(id: number): Observable<FishCard> {
    return this.http.post<FishCard>(`${this.baseUrl}/admin/fish-cards/${id}/approve`, {}, { withCredentials: true });
  }

  reject(id: number, reason: string): Observable<FishCard> {
    return this.http.post<FishCard>(
      `${this.baseUrl}/admin/fish-cards/${id}/reject`,
      { reason },
      { withCredentials: true },
    );
  }

  // ---------- EDITOR ----------
  listEditor(search?: string): Observable<FishCard[]> {
    let params = new HttpParams();
    if (search?.trim()) params = params.set('search', search.trim());
    return this.http.get<FishCard[]>(`${this.baseUrl}/editor/fish-cards`, { params, withCredentials: true });
  }

  createEditorWithImage(dto: CreateFishCardDto, file?: File): Observable<FishCard> {
    const fd = new FormData();
    for (const [k, v] of Object.entries(dto)) {
      if (v === undefined || v === null || v === '') continue;
      fd.append(k, String(v));
    }
    if (file) fd.append('file', file);

    return this.http.post<FishCard>(`${this.baseUrl}/editor/fish-cards`, fd, { withCredentials: true });
  }

  updateEditor(id: number, dto: UpdateFishCardDto): Observable<FishCard> {
    return this.http.patch<FishCard>(`${this.baseUrl}/editor/fish-cards/${id}`, dto, { withCredentials: true });
  }

  removeEditor(id: number): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${this.baseUrl}/editor/fish-cards/${id}`, { withCredentials: true });
  }

  // ---------- UPLOAD (ADMIN + EDITOR) ----------
  uploadImage(file: File): Observable<{ url: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<{ url: string }>(`${this.baseUrl}/species/fish/upload`, fd, { withCredentials: true });
  }
}
