import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Subject } from 'rxjs';
import { environment } from '../../environments/environment';

export type WaterType = 'EAU_DOUCE' | 'EAU_DE_MER';

export interface MeasurementCreateDto {
  measuredAt: string;
  ph?: number | null;
  temp?: number | null;
  // douce
  kh?: number | null;
  gh?: number | null;
  no2?: number | null;
  no3?: number | null;
  fe?: number | null;
  k?: number | null;
  sio2?: number | null;
  nh3?: number | null;
  // mer
  dkh?: number | null;
  salinity?: number | null; // ppt
  ca?: number | null;
  mg?: number | null;
  po4?: number | null;
  comment?: string | null;
}

export interface Measurement extends Required<MeasurementCreateDto> {
  id: number;
  aquariumId: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class MeasurementsService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  /** 🔔 Événement global: “les mesures de l’aquarium X ont changé” */
  private _changed$ = new Subject<{ aquariumId: number }>();
  /** À écouter côté charts */
  changed$ = this._changed$.asObservable();
  /** À émettre après création/suppression/modification */
  notifyChanged(aquariumId: number) {
    this._changed$.next({ aquariumId });
  }

  listForAquarium(aquariumId: number) {
    return firstValueFrom(
      this.http.get<Measurement[]>(`${this.base}/aquariums/${aquariumId}/measurements`)
    );
  }

  createForAquarium(aquariumId: number, dto: MeasurementCreateDto) {
    return firstValueFrom(
      this.http.post<Measurement>(`${this.base}/aquariums/${aquariumId}/measurements`, dto)
    );
  }
}
