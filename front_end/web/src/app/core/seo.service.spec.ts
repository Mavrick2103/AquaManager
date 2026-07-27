import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  let service: SeoService;
  let document: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SeoService);
    document = TestBed.inject(DOCUMENT);
    document.head.querySelector('link[rel="canonical"]')?.remove();
    document.getElementById('aqm-structured-data')?.remove();
  });

  it('creates indexable metadata for a public page', () => {
    service.apply({
      title: 'Néon bleu – Fiche poisson | AquaManager',
      description: 'Une fiche complète pour maintenir le Néon bleu.',
      path: '/poissons/neon-bleu',
      image: '/uploads/fish/neon.jpg',
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'Fiche poisson : Néon bleu',
      },
    });

    expect(document.title).toBe('Néon bleu – Fiche poisson | AquaManager');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toContain(
      'Néon bleu',
    );
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain(
      'index,follow',
    );
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://aquamanager.fr/poissons/neon-bleu',
    );
    expect(document.getElementById('aqm-structured-data')?.textContent).toContain(
      'Fiche poisson : Néon bleu',
    );
  });

  it('marks missing public content as noindex', () => {
    service.markNotFound();

    expect(document.title).toBe('Page introuvable – AquaManager');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex,follow',
    );
  });
});
