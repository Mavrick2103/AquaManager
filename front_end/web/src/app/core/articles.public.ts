import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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

@Injectable({ providedIn: 'root' })
export class PublicArticlesApi {
  private readonly baseUrl = environment.apiUrl; // ex: http://localhost:3000/api

  constructor(private readonly http: HttpClient) {}

  /**
   * Back: GET /api/public/articles?q=...&theme=themeSlug
   */
  list(params?: { q?: string; theme?: string }): Observable<ArticleDto[]> {
    let p = new HttpParams();

    if (params?.q?.trim()) p = p.set('q', params.q.trim());
    if (params?.theme?.trim()) p = p.set('theme', params.theme.trim());

    return this.http.get<ArticleDto[]>(`${this.baseUrl}/public/articles`, { params: p });
  }

  /**
   * Ton back n'a PAS de route /public/articles/themes actuellement.
   * => soit tu la crées côté Nest, soit tu supprimes cette méthode.
   *
   * Je te la laisse ici si tu ajoutes l'endpoint plus tard :
   */
  themes(): Observable<ThemeDto[]> {
    return this.http.get<ThemeDto[]>(`${this.baseUrl}/public/articles/themes`);
  }

  /**
   * Back: GET /api/public/articles/:slug
   */
  getBySlug(slug: string): Observable<ArticleDto> {
    return this.http.get<ArticleDto>(
      `${this.baseUrl}/public/articles/${encodeURIComponent(slug)}`
    );
  }
}
