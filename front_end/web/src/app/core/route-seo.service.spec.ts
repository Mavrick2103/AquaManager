import { Component, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Title } from '@angular/platform-browser';
import { SeoService } from './seo.service';
import { RouteSeoService } from './route-seo.service';

@Component({ selector: 'test-seo-page', standalone: true, template: '' })
class Page {}
@Component({ selector: 'test-seo-detail', standalone: true, template: '' })
class Detail {
  constructor() {
    inject(SeoService).apply({ title: 'Néon bleu', description: 'Fiche espèce', path: '/poissons/neon', structuredData: { '@type': 'Article' } });
  }
}
describe('Route metadata', () => {
  it('keeps detail metadata, then removes it when navigating to a private page', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([
      { path: 'poissons/neon', component: Detail },
      { path: 'login', component: Page, data: { title: 'Connexion', robots: 'noindex' } },
      { path: 'aquariums', component: Page, canActivate: [() => true] },
    ])] });
    TestBed.inject(RouteSeoService).initialize();
    const harness = await RouterTestingHarness.create('/poissons/neon');
    const document = TestBed.inject(DOCUMENT);
    expect(TestBed.inject(Title).getTitle()).toBe('Néon bleu');
    expect(document.getElementById('aqm-structured-data')).not.toBeNull();
    await harness.navigateByUrl('/login?next=secret');
    expect(TestBed.inject(Title).getTitle()).toBe('Connexion');
    expect(document.getElementById('aqm-structured-data')).toBeNull();
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://aquamanager.fr/login');
    await harness.navigateByUrl('/aquariums');
    expect(TestBed.inject(Title).getTitle()).toBe('Mes aquariums – AquaManager');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,nofollow');
  });
});
