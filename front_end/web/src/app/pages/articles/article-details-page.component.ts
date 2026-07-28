import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser, Location } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { finalize, take } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { PublicArticlesApi, ArticleDto } from '../../core/articles.public';
import { SeoService } from '../../core/seo.service';
import { environment } from '../../../environments/environment';

type TocItem = { id: string; text: string; level: 2 | 3 };

@Component({
  selector: 'app-article-details-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './article-details-page.component.html',
  styleUrls: ['./article-details-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleDetailsPageComponent implements OnInit {
  loading = false;
  notFound = false;

  article: ArticleDto | null = null;

  safeHtml = '';
  toc: TocItem[] = [];

  private readonly apiOrigin = this.computeApiOrigin(environment.apiUrl);

  constructor(
    private readonly api: PublicArticlesApi,
    private readonly route: ActivatedRoute,
    private readonly location: Location,
    private readonly cdr: ChangeDetectorRef,
    private readonly seo: SeoService,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  ngOnInit(): void {
    this.loading = true;

    const slug = String(this.route.snapshot.paramMap.get('slug') || '').trim();
    if (!slug) {
      this.loading = false;
      this.notFound = true;
      this.seo.markNotFound();
      this.cdr.markForCheck();
      return;
    }

    this.api.getBySlug(slug)
      .pipe(
        take(1),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (a) => {
          if (!a?.id) {
            this.notFound = true;
            this.article = null;
            this.seo.markNotFound();
            this.cdr.markForCheck();
            return;
          }

          this.article = a;

          const prepared = this.prepareContent(a.content || '');
          this.safeHtml = prepared.html;
          this.toc = prepared.toc;

          const description = this.buildDescription(a.excerpt || a.content);
          const image = this.coverSrc(a.coverImageUrl);
          this.seo.apply({
            title: `${a.title} – AquaManager`,
            description,
            path: `/articles/${encodeURIComponent(a.slug)}`,
            image,
            type: 'article',
            structuredData: {
              '@context': 'https://schema.org',
              '@type': 'Article',
              headline: a.title,
              description,
              image: image ? [image] : undefined,
              datePublished: a.publishedAt || a.createdAt,
              dateModified: a.updatedAt,
              mainEntityOfPage: `https://aquamanager.fr/articles/${encodeURIComponent(a.slug)}`,
              publisher: {
                '@type': 'Organization',
                name: 'AquaManager',
                logo: {
                  '@type': 'ImageObject',
                  url: 'https://aquamanager.fr/Logo_AquaManger.png',
                },
              },
            },
          });

          if (isPlatformBrowser(this.platformId)) {
            this.trackArticleView(slug);
            queueMicrotask(() => this.bindSmoothAnchorScroll());
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error(err);
          this.notFound = true;
          this.article = null;
          this.seo.markNotFound();
          this.cdr.markForCheck();
        },
      });
  }

  back(): void {
    this.location.back();
  }

  coverSrc(raw: unknown): string | null {
    const v = String(raw ?? '').trim();
    if (!v) return null;

    if (/^https?:\/\//i.test(v) || v.startsWith('data:')) return v;

    const normalized = v.startsWith('/') ? v : `/${v}`;
    if (normalized.startsWith('/uploads/')) return `${this.apiOrigin}${normalized}`;
    return v;
  }

  /** transforme content (texte) en HTML simple + sommaire */
  private prepareContent(content: string): { html: string; toc: TocItem[] } {
    const lines = String(content ?? '').split(/\r?\n/);

    const toc: TocItem[] = [];
    let html = '';

    let inList = false;
    const closeList = () => {
      if (inList) { html += '</ul>'; inList = false; }
    };

    for (const raw of lines) {
      const line = raw.trim();

      // Headings markdown-like: ## / ###
      const h2 = line.match(/^##\s+(.+)$/);
      const h3 = line.match(/^###\s+(.+)$/);

      if (h2) {
        closeList();
        const text = h2[1].trim();
        const id = this.slugify(text);
        toc.push({ id, text, level: 2 });
        html += `<h2 id="${id}">${this.escapeHtml(text)}</h2>`;
        continue;
      }

      if (h3) {
        closeList();
        const text = h3[1].trim();
        const id = this.slugify(text);
        toc.push({ id, text, level: 3 });
        html += `<h3 id="${id}">${this.escapeHtml(text)}</h3>`;
        continue;
      }

      // Horizontal separator.
      if (/^---+$/.test(line)) {
        closeList();
        html += '<hr class="article-separator" />';
        continue;
      }

      // List "- item" (ou "-- item", etc.)
      const li = line.match(/^-+\s+(.+)$/);
      if (li) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${this.inlineFormat(li[1])}</li>`;
        continue;
      }

      // empty line
      if (!line) {
        closeList();
        continue;
      }

      // paragraph
      closeList();
      html += `<p>${this.inlineFormat(line)}</p>`;
    }

    closeList();
    return { html, toc };
  }

  private inlineFormat(text: string): string {
    // **bold** + *italic*
    let out = this.escapeHtml(text);
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
    return out;
  }

  private escapeHtml(s: string): string {
    return s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  private slugify(s: string): string {
    return String(s)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 64);
  }

  private buildDescription(value: string): string {
    const plainText = String(value || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/[#*_`>\[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return (plainText || 'Conseils et informations pour mieux entretenir votre aquarium.').slice(0, 160);
  }

  private bindSmoothAnchorScroll(): void {
    const links = Array.from(document.querySelectorAll('a[data-anchor="1"]')) as HTMLAnchorElement[];
    links.forEach((a) => {
      a.addEventListener('click', (ev) => {
        ev.preventDefault();
        const id = a.getAttribute('href')?.replace('#', '') || '';
        if (!id) return;
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  private computeApiOrigin(apiUrl: string): string {
    return String(apiUrl || '').replace(/\/api\/?$/, '');
  }

  // =========================
  // ✅ TRACKING DES VUES
  // =========================

  private trackArticleView(slug: string): void {
    const viewKey = this.getOrCreateViewKey();

    this.api.trackView(slug, viewKey)
      .pipe(take(1))
      .subscribe({
        next: () => {},
        error: (err) => console.warn('track view failed', err),
      });
  }

  private getOrCreateViewKey(): string {
    const STORAGE_KEY = 'aqm_view_key';
    const existing = localStorage.getItem(STORAGE_KEY);

    if (existing && existing.length >= 16) return existing;

    const created = (globalThis.crypto?.randomUUID?.() ?? this.fallbackKey());
    localStorage.setItem(STORAGE_KEY, created);
    return created;
  }

  private fallbackKey(): string {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
  }
}
