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
  salinity?: number | null;
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

  private _changed$ = new Subject<{ aquariumId: number }>();
  changed$ = this._changed$.asObservable();

  notifyChanged(aquariumId: number) {
    this._changed$.next({ aquariumId });
  }

  listForAquarium(aquariumId: number) {
    const url = `${this.base}/aquariums/${aquariumId}/measurements`;
    return firstValueFrom(this.http.get<Measurement[]>(url));
  }

  async getLastForAquarium(aquariumId: number): Promise<Measurement | null> {
    const list = await this.listForAquarium(aquariumId);
    if (!Array.isArray(list) || list.length === 0) return null;
    const sorted = [...list].sort(
      (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
    );
    return sorted[0] ?? null;
  }

  createForAquarium(aquariumId: number, dto: MeasurementCreateDto) {
    const url = `${this.base}/aquariums/${aquariumId}/measurements`;
    return firstValueFrom(this.http.post<Measurement>(url, dto));
  }

  deleteForAquarium(aquariumId: number, id: number) {
    const url = `${this.base}/aquariums/${aquariumId}/measurements/${id}`;
    return firstValueFrom(this.http.delete<void>(url));
  }
}
