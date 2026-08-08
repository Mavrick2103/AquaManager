import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type EmailAudience = 'ALL' | 'INACTIVE' | 'NEVER_CONNECTED' | 'SINGLE_USER';
export type ConsentFilter = 'ANY' | 'OPTED_IN' | 'OPTED_OUT';
export type EmailAudienceFilter = { audience: EmailAudience; consent: ConsentFilter; inactiveDays?: number; userId?: number };
export type EmailRecipient = { id: number; fullName: string; email: string; lastActivityAt: string | null; optedIn: boolean };
export type EmailPreview = { count: number; optedInCount: number; recipients: EmailRecipient[]; truncated: boolean };

@Injectable({ providedIn: 'root' })
export class AdminEmailingService {
  private readonly url = `${environment.apiUrl}/admin/emailing`;
  constructor(private readonly http: HttpClient) {}
  preview(filter: EmailAudienceFilter): Observable<EmailPreview> {
    return this.http.post<EmailPreview>(`${this.url}/preview`, filter, { withCredentials: true });
  }
  send(payload: EmailAudienceFilter & { subject: string; message: string; actionUrl?: string; actionLabel?: string }): Observable<{ requested: number; sent: number; failed: number }> {
    return this.http.post<{ requested: number; sent: number; failed: number }>(`${this.url}/send`, payload, { withCredentials: true });
  }
}
