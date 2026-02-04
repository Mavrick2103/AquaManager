import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** =======================
 *  TYPES
 *  ======================= */

export type ArticleStatus = 'DRAFT' | 'PUBLISHED';

export interface ThemeDto {
  id: number;
  name: string;
  slug: string;
}

export interface ArticleDto {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImageUrl: string | null;
  status: ArticleStatus;
  viewsCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  themeId: number;
  theme?: ThemeDto;
}

export interface ArticleStatsDto {
  articleId: number;
  days: number;
  fromDay: string;
  toDay: string;
  totalViewsAllTime: number;
  totalViewsPeriod: number;
  totalUniquePeriod: number;
  daily: Array<{ day: string; views: number; uniqueViews: number }>;
}

export type CreateArticlePayload = {
  title: string;
  excerpt?: string;
  content: string;
  coverImageUrl?: string;
  status: ArticleStatus;
  themeId: number;
};

export type UpdateArticlePayload = Partial<{
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
  status: ArticleStatus;
  themeId: number;
}>;

/** =======================
 *  SERVICE
 *  ======================= */

@Injectable({ providedIn: 'root' })
export class AdminArticlesService {
  private readonly baseUrl = environment.apiUrl; // ex: http://localhost:3000/api

  constructor(private readonly http: HttpClient) {}

  list(params?: { q?: string; themeId?: number; status?: ArticleStatus | '' }): Observable<ArticleDto[]> {
    let p = new HttpParams();

    if (params?.q?.trim()) p = p.set('q', params.q.trim());
    if (params?.themeId) p = p.set('themeId', String(params.themeId));
    if (params?.status) p = p.set('status', String(params.status));

    return this.http.get<ArticleDto[]>(`${this.baseUrl}/admin/articles`, {
      params: p,
      withCredentials: true,
    });
  }

  themes(): Observable<ThemeDto[]> {
    return this.http.get<ThemeDto[]>(`${this.baseUrl}/admin/articles/themes`, {
      withCredentials: true,
    });
  }

  getById(id: number): Observable<ArticleDto> {
    return this.http.get<ArticleDto>(`${this.baseUrl}/admin/articles/${id}`, {
      withCredentials: true,
    });
  }

  create(payload: CreateArticlePayload): Observable<ArticleDto> {
    return this.http.post<ArticleDto>(`${this.baseUrl}/admin/articles`, payload, {
      withCredentials: true,
    });
  }

  update(id: number, payload: UpdateArticlePayload): Observable<ArticleDto> {
    return this.http.patch<ArticleDto>(`${this.baseUrl}/admin/articles/${id}`, payload, {
      withCredentials: true,
    });
  }

  delete(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/admin/articles/${id}`, {
      withCredentials: true,
    });
  }

  stats(id: number, days = 30): Observable<ArticleStatsDto> {
    return this.http.get<ArticleStatsDto>(`${this.baseUrl}/admin/articles/${id}/stats`, {
      params: new HttpParams().set('days', String(days)),
      withCredentials: true,
    });
  }
}
