import { DOCUMENT } from '@angular/common';
import { inject, Injectable, RESPONSE_INIT } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface SeoPage {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type?: 'website' | 'article';
  structuredData?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });
  private readonly origin = 'https://aquamanager.fr';

  apply(page: SeoPage): void {
    const canonicalUrl = new URL(page.path, this.origin).toString();
    const imageUrl = page.image ? new URL(page.image, this.origin).toString() : `${this.origin}/Logo_AquaManger.png`;

    this.title.setTitle(page.title);
    this.updateName('description', page.description);
    this.updateName('robots', 'index,follow,max-image-preview:large');
    this.updateProperty('og:title', page.title);
    this.updateProperty('og:description', page.description);
    this.updateProperty('og:type', page.type ?? 'website');
    this.updateProperty('og:url', canonicalUrl);
    this.updateProperty('og:image', imageUrl);
    this.updateProperty('og:image:alt', page.title);
    this.updateProperty('og:site_name', 'AquaManager');
    this.updateProperty('og:locale', 'fr_FR');
    this.updateName('twitter:card', 'summary_large_image');
    this.updateName('twitter:title', page.title);
    this.updateName('twitter:description', page.description);
    this.updateName('twitter:image', imageUrl);
    this.setCanonical(canonicalUrl);
    this.setStructuredData(page.structuredData ?? null);
  }

  markNotFound(): void {
    if (this.responseInit) {
      this.responseInit.status = 404;
    }

    this.title.setTitle('Page introuvable – AquaManager');
    this.updateName('robots', 'noindex,follow');
    this.setStructuredData(null);
  }

  private updateName(name: string, content: string): void {
    this.meta.updateTag({ name, content }, `name="${name}"`);
  }

  private updateProperty(property: string, content: string): void {
    this.meta.updateTag({ property, content }, `property="${property}"`);
  }

  private setCanonical(url: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }
    link.href = url;
  }

  private setStructuredData(data: Record<string, unknown> | null): void {
    this.document.getElementById('aqm-structured-data')?.remove();
    if (!data) return;

    const script = this.document.createElement('script');
    script.id = 'aqm-structured-data';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    this.document.head.appendChild(script);
  }
}
