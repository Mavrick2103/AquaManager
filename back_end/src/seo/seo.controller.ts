import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

import { ArticlesService } from '../articles/articles.service';
import { FishCardsService } from '../catalog/fish-cards/fish-card.service';
import { PlantCardsService } from '../catalog/plant-cards/plant-card.service';

type SitemapUrl = {
  loc: string;
  lastmod?: string;
  changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority?: string;
};

@Public()
@Controller()
export class SeoController {
  private readonly baseUrl = 'https://aquamanager.fr';

  constructor(
    private readonly articlesService: ArticlesService,
    private readonly fishCardsService: FishCardsService,
    private readonly plantCardsService: PlantCardsService,
  ) {}

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async sitemapXml() {
    const staticUrls: SitemapUrl[] = [
      { loc: `${this.baseUrl}/`, changefreq: 'weekly', priority: '1.0' },
      { loc: `${this.baseUrl}/a-propos-gestion-aquarium`, changefreq: 'monthly', priority: '0.8' },
      { loc: `${this.baseUrl}/contact`, changefreq: 'monthly', priority: '0.6' },
      { loc: `${this.baseUrl}/articles`, changefreq: 'weekly', priority: '0.9' },
      { loc: `${this.baseUrl}/poissons`, changefreq: 'weekly', priority: '0.8' },
      { loc: `${this.baseUrl}/plantes`, changefreq: 'weekly', priority: '0.8' },
    ];

    const [articles, fishes, plants] = await Promise.all([
      this.articlesService.listPublishedSlugsForSitemap(),
      this.fishCardsService.listPublishedSlugsForSitemap(),
      this.plantCardsService.listPublishedSlugsForSitemap(),
    ]);

    const articleUrls: SitemapUrl[] = articles.map((a) => ({
      loc: `${this.baseUrl}/articles/${a.slug}`,
      lastmod: a.lastmod,
      changefreq: 'weekly',
      priority: '0.7',
    }));

    const fishUrls: SitemapUrl[] = fishes.map((f) => ({
      loc: `${this.baseUrl}/poissons/${f.slug}`,
      lastmod: f.lastmod,
      changefreq: 'monthly',
      priority: '0.7',
    }));

    const plantUrls: SitemapUrl[] = plants.map((p) => ({
      loc: `${this.baseUrl}/plantes/${p.slug}`,
      lastmod: p.lastmod,
      changefreq: 'monthly',
      priority: '0.7',
    }));

    const urls: SitemapUrl[] = [...staticUrls, ...articleUrls, ...fishUrls, ...plantUrls];

    const body = urls
      .map((u) => {
        const lastmod = u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : '';
        const changefreq = u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : '';
        const priority = u.priority ? `<priority>${u.priority}</priority>` : '';
        return `<url><loc>${u.loc}</loc>${lastmod}${changefreq}${priority}</url>`;
      })
      .join('');

    return (
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
      body +
      `</urlset>`
    );
  }
}
