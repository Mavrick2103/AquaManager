import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type MarketingStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PUBLISHED';
export type MarketingFormat = 'POST' | 'CAROUSEL' | 'REEL' | 'STORY';

export interface MarketingPost {
  id: number;
  title: string;
  caption: string;
  mediaUrl: string | null;
  sourceUrl: string | null;
  format: MarketingFormat;
  status: MarketingStatus;
  scheduledAt: string | null;
  rejectionReason: string | null;
  generatedByAi: boolean;
  aiRationale: string | null;
  instagramMediaId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MarketingPostPayload = {
  title: string;
  caption: string;
  mediaUrl?: string;
  sourceUrl?: string;
  format: MarketingFormat;
  status?: 'DRAFT' | 'PENDING_APPROVAL';
  scheduledAt?: string;
};

export interface MarketingAgentSettings {
  id: number;
  enabled: boolean;
  cadence: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  dayOfWeek: number;
  hour: number;
  minute: number;
  timezone: string;
  lastGeneratedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class MarketingService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/marketing`;

  list(): Observable<MarketingPost[]> {
    return this.http.get<MarketingPost[]>(this.base, { withCredentials: true });
  }

  create(payload: MarketingPostPayload): Observable<MarketingPost> {
    return this.http.post<MarketingPost>(this.base, payload, { withCredentials: true });
  }

  approve(id: number): Observable<MarketingPost> {
    return this.http.post<MarketingPost>(`${this.base}/${id}/approve`, {}, { withCredentials: true });
  }

  reject(id: number, reason: string): Observable<MarketingPost> {
    return this.http.post<MarketingPost>(
      `${this.base}/${id}/reject`,
      { reason },
      { withCredentials: true },
    );
  }

  generate(topic: string, format: MarketingFormat): Observable<MarketingPost> {
    return this.http.post<MarketingPost>(
      `${this.base}/generate`,
      { topic: topic.trim() || undefined, format },
      { withCredentials: true },
    );
  }

  instagramStatus(): Observable<{
    connected: boolean;
    username: string | null;
    accountId: string | null;
    error?: string;
  }> {
    return this.http.get<{
      connected: boolean;
      username: string | null;
      accountId: string | null;
      error?: string;
    }>(`${this.base}/instagram/status`, { withCredentials: true });
  }

  publish(id: number): Observable<MarketingPost> {
    return this.http.post<MarketingPost>(
      `${this.base}/${id}/publish`,
      {},
      { withCredentials: true },
    );
  }

  generateImage(id: number): Observable<MarketingPost> {
    return this.http.post<MarketingPost>(
      `${this.base}/${id}/generate-image`,
      {},
      { withCredentials: true },
    );
  }

  revise(id: number, instruction: string): Observable<MarketingPost> {
    return this.http.post<MarketingPost>(
      `${this.base}/${id}/revise`,
      { reason: instruction },
      { withCredentials: true },
    );
  }

  removeGeneratedPost(id: number): Observable<{ deleted: boolean; id: number }> {
    return this.http.delete<{ deleted: boolean; id: number }>(
      `${this.base}/${id}`,
      { withCredentials: true },
    );
  }

  getAgentSettings(): Observable<MarketingAgentSettings> {
    return this.http.get<MarketingAgentSettings>(
      `${this.base}/agent/settings`,
      { withCredentials: true },
    );
  }

  updateAgentSettings(
    settings: Pick<MarketingAgentSettings, 'enabled' | 'cadence' | 'dayOfWeek' | 'hour' | 'minute'>,
  ): Observable<MarketingAgentSettings> {
    return this.http.patch<MarketingAgentSettings>(
      `${this.base}/agent/settings`,
      settings,
      { withCredentials: true },
    );
  }
}
