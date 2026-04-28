import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type RecommendationSeverity = 'INFO' | 'WARN' | 'URGENT';
export type RecommendationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
export type RecommendationActionType = 'CREATE_TASK';

export interface Recommendation {
  id: number;
  userId: number;
  aquariumId: number;
  measurementId?: number | null;
  ruleKey: string;
  title: string;
  message: string;
  severity: RecommendationSeverity;
  status: RecommendationStatus;
  actionType: RecommendationActionType;
  actionPayload?: any | null;
  decidedAt?: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class RecommendationsService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  listPending(aquariumId?: number) {
    const url = `${this.base}/recommendations/pending`;
    let params = new HttpParams();
    if (aquariumId) params = params.set('aquariumId', String(aquariumId));
    return firstValueFrom(this.http.get<Recommendation[]>(url, { params }));
  }

  accept(id: number) {
    const url = `${this.base}/recommendations/${id}/accept`;
    return firstValueFrom(this.http.post<Recommendation>(url, {}));
  }

  reject(id: number) {
    const url = `${this.base}/recommendations/${id}/reject`;
    return firstValueFrom(this.http.post<Recommendation>(url, {}));
  }
}
