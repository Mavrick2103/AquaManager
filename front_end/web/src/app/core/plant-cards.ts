import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Types */
export type WaterType = 'EAU_DOUCE' | 'EAU_DE_MER' | 'SAUMATRE';

export type PlantCategory =
  | 'TIGE'
  | 'ROSETTE'
  | 'RHIZOME'
  | 'MOUSSE'
  | 'GAZONNANTE'
  | 'BULBE'
  | 'FLOTTANTE'
  | 'EPIPHYTE';

export type PlantPlacement =
  | 'AVANT_PLAN'
  | 'MILIEU'
  | 'ARRIERE_PLAN'
  | 'SUR_SUPPORT'
  | 'SURFACE';

export type GrowthRate = 'LENTE' | 'MOYENNE' | 'RAPIDE';
export type Light = 'FAIBLE' | 'MOYEN' | 'FORT';
export type Co2 = 'AUCUN' | 'RECOMMANDE' | 'OBLIGATOIRE';
export type Difficulty = 'FACILE' | 'MOYEN' | 'DIFFICILE';

export type Propagation =
  | 'BOUTURAGE'
  | 'STOLON'
  | 'RHIZOME'
  | 'DIVISION'
  | 'SPORES'
  | 'GRAINES'
  | 'AUCUNE';

export interface PlantCard {
  id: number;

  commonName: string;
  scientificName: string | null;
  family: string | null;
  origin: string | null;
  waterType: WaterType;

  category: PlantCategory | null;
  placement: PlantPlacement | null;
  growthRate: GrowthRate | null;
  maxHeightCm: number | null;
  propagation: Propagation | null;

  light: Light | null;
  co2: Co2 | null;
  difficulty: Difficulty | null;

  tempMin: number | null;
  tempMax: number | null;
  phMin: number | null;
  phMax: number | null;
  ghMin: number | null;
  ghMax: number | null;
  khMin: number | null;
  khMax: number | null;

  needsFe: boolean | null;
  needsNo3: boolean | null;
  needsPo4: boolean | null;
  needsK: boolean | null;
  substrateRequired: boolean | null;

  trimming: string | null;
  compatibility: string | null;
  notes: string | null;

  imageUrl: string | null;

  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export type CreatePlantCardDto = {
  commonName: string;
  waterType: WaterType;

  scientificName?: string | null;
  family?: string | null;
  origin?: string | null;

  category?: PlantCategory | null;
  placement?: PlantPlacement | null;
  growthRate?: GrowthRate | null;
  maxHeightCm?: number | null;
  propagation?: Propagation | null;

  light?: Light | null;
  co2?: Co2 | null;
  difficulty?: Difficulty | null;

  tempMin?: number | null;
  tempMax?: number | null;
  phMin?: number | null;
  phMax?: number | null;
  ghMin?: number | null;
  ghMax?: number | null;
  khMin?: number | null;
  khMax?: number | null;

  needsFe?: boolean | null;
  needsNo3?: boolean | null;
  needsPo4?: boolean | null;
  needsK?: boolean | null;
  substrateRequired?: boolean | null;

  trimming?: string | null;
  compatibility?: string | null;
  notes?: string | null;

  // ⚠️ pas d'imageUrl ici (création multipart -> backend set l'URL)
  isActive?: boolean;
};

export type UpdatePlantCardDto = Partial<
  Omit<CreatePlantCardDto, 'commonName' | 'waterType'> & {
    commonName: string;
    waterType: WaterType;
    imageUrl: string | null;
  }
>;

@Injectable({ providedIn: 'root' })
export class PlantCardsApi {
  private readonly baseUrl = environment.apiUrl; // ex: http://localhost:3000/api

  constructor(private readonly http: HttpClient) {}

  listAdmin(search?: string): Observable<PlantCard[]> {
    let params = new HttpParams();
    if (search?.trim()) params = params.set('search', search.trim());

    return this.http.get<PlantCard[]>(`${this.baseUrl}/admin/plant-cards`, {
      params,
      withCredentials: true,
    });
  }

  /**
   * ✅ CREATE + IMAGE (multipart/form-data)
   * POST /api/admin/plant-cards
   * - fields: dto
   * - file: "file" (optionnel)
   */
  createWithImage(dto: CreatePlantCardDto, file?: File): Observable<PlantCard> {
    const fd = new FormData();

    for (const [k, v] of Object.entries(dto)) {
      if (v === undefined || v === null || v === '') continue;
      fd.append(k, String(v));
    }
    if (file) fd.append('file', file);

    return this.http.post<PlantCard>(`${this.baseUrl}/admin/plant-cards`, fd, {
      withCredentials: true,
    });
  }

  /** Update JSON (PATCH) */
  update(id: number, dto: UpdatePlantCardDto): Observable<PlantCard> {
    return this.http.patch<PlantCard>(`${this.baseUrl}/admin/plant-cards/${id}`, dto, {
      withCredentials: true,
    });
  }

  /** Delete */
  remove(id: number): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${this.baseUrl}/admin/plant-cards/${id}`, {
      withCredentials: true,
    });
  }

  /** Upload image (pratique en EDIT) */
  uploadImage(file: File): Observable<{ url: string }> {
    const fd = new FormData();
    fd.append('file', file);

    return this.http.post<{ url: string }>(`${this.baseUrl}/admin/plant-cards/upload`, fd, {
      withCredentials: true,
    });
  }
}
