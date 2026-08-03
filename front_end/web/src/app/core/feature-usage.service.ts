import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { EMPTY } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FeatureUsageService {
  private readonly storageKey = 'aquamanager-view-key';

  constructor(
    private readonly http: HttpClient,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  trackSpeciesView(kind: 'fish' | 'plant', resourceId: number): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const visitorKey = this.getVisitorKey();
    this.http
      .post(
        `${environment.apiUrl}/feature-usage/species-view`,
        { kind, resourceId },
        { headers: new HttpHeaders({ 'x-view-key': visitorKey }) },
      )
      .pipe(catchError(() => EMPTY))
      .subscribe();
  }

  private getVisitorKey(): string {
    const existing = localStorage.getItem(this.storageKey);
    if (existing && /^[a-zA-Z0-9-]{16,64}$/.test(existing)) return existing;

    const generated = globalThis.crypto?.randomUUID?.()
      ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(this.storageKey, generated);
    return generated;
  }
}
