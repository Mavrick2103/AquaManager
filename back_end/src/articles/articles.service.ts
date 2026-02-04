import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';

import { Article } from './entities/article.entity';
import { Theme } from './entities/theme.entity';
import { ArticleViewDaily } from './entities/article-view-daily.entity';
import { ArticleUniqueView } from './entities/article-unique-view.entity';

import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { slugify } from './utils/slugify';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article) private readonly articleRepo: Repository<Article>,
    @InjectRepository(Theme) private readonly themeRepo: Repository<Theme>,
    @InjectRepository(ArticleViewDaily) private readonly dailyRepo: Repository<ArticleViewDaily>,
    @InjectRepository(ArticleUniqueView) private readonly uniqueRepo: Repository<ArticleUniqueView>,
  ) {}

  // ---------------- utils ----------------
  private todayISODate(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private async ensureUniqueSlug(base: string, ignoreId?: number): Promise<string> {
    let slug = base || 'article';
    let i = 1;

    while (true) {
      const existing = await this.articleRepo.findOne({ where: { slug } });
      if (!existing) return slug;
      if (ignoreId && existing.id === ignoreId) return slug;

      slug = `${base}-${i++}`;
      if (i > 2000) throw new BadRequestException('Unable to generate unique slug');
    }
  }

  // ---------------- themes (admin) ----------------
  async listThemes() {
    return this.themeRepo.find({ order: { name: 'ASC' } });
  }

  async createTheme(name: string) {
    const slug = slugify(name);
    const exists = await this.themeRepo.findOne({ where: [{ name }, { slug }] });
    if (exists) throw new BadRequestException('Theme already exists');

    return this.themeRepo.save(this.themeRepo.create({ name, slug }));
  }

  // ---------------- articles (admin) ----------------
  async adminList(params: { q?: string; themeId?: number; status?: string }) {
    const { q, themeId, status } = params;

    const whereBase: any = {};
    if (themeId) whereBase.themeId = themeId;
    if (status) whereBase.status = status;

    if (q?.trim()) {
      return this.articleRepo.find({
        where: [
          { ...whereBase, title: Like(`%${q}%`) },
          { ...whereBase, excerpt: Like(`%${q}%`) },
        ],
        order: { updatedAt: 'DESC' },
        relations: ['theme'],
      });
    }

    return this.articleRepo.find({
      where: whereBase,
      order: { updatedAt: 'DESC' },
      relations: ['theme'],
    });
  }

  async adminGetById(id: number) {
    const article = await this.articleRepo.findOne({ where: { id }, relations: ['theme'] });
    if (!article) throw new NotFoundException('Article not found');
    return article;
  }

  async createArticle(dto: CreateArticleDto) {
    const theme = await this.themeRepo.findOne({ where: { id: dto.themeId } });
    if (!theme) throw new BadRequestException('Invalid themeId');

    const baseSlug = slugify(dto.title);
    const slug = await this.ensureUniqueSlug(baseSlug);

    const article = this.articleRepo.create({
      ...dto,
      slug,
      publishedAt: dto.status === 'PUBLISHED' ? new Date() : null,
    });

    return this.articleRepo.save(article);
  }

  async updateArticle(id: number, dto: UpdateArticleDto) {
    const article = await this.articleRepo.findOne({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');

    if (dto.themeId) {
      const theme = await this.themeRepo.findOne({ where: { id: dto.themeId } });
      if (!theme) throw new BadRequestException('Invalid themeId');
    }

    if (dto.title && dto.title !== article.title) {
      const baseSlug = slugify(dto.title);
      article.slug = await this.ensureUniqueSlug(baseSlug, article.id);
    }

    if (dto.status === 'PUBLISHED' && !article.publishedAt) {
      article.publishedAt = new Date();
    }
    if (dto.status === 'DRAFT') {
      article.publishedAt = null;
    }

    Object.assign(article, dto);
    return this.articleRepo.save(article);
  }

  async deleteArticle(id: number) {
    const res = await this.articleRepo.delete({ id });
    if (!res.affected) throw new NotFoundException('Article not found');
    return { ok: true };
  }

  // ---------------- public ----------------
  async publicList(params: { q?: string; theme?: string }) {
    const { q, theme } = params;

    let themeId: number | undefined;
    if (theme) {
      const t = await this.themeRepo.findOne({ where: { slug: theme } });
      if (!t) return [];
      themeId = t.id;
    }

    const baseWhere: any = { status: 'PUBLISHED' };
    if (themeId) baseWhere.themeId = themeId;

    if (q?.trim()) {
      return this.articleRepo.find({
        where: [
          { ...baseWhere, title: Like(`%${q}%`) },
          { ...baseWhere, excerpt: Like(`%${q}%`) },
        ],
        order: { publishedAt: 'DESC' },
        relations: ['theme'],
      });
    }

    return this.articleRepo.find({
      where: baseWhere,
      order: { publishedAt: 'DESC' },
      relations: ['theme'],
    });
  }

  async publicGetBySlug(slug: string) {
    const article = await this.articleRepo.findOne({
      where: { slug, status: 'PUBLISHED' },
      relations: ['theme'],
    });
    if (!article) throw new NotFoundException('Article not found');
    return article;
  }

  // ---------------- tracking (views/day + unique/day) ----------------
  async trackViewBySlug(slug: string, viewKey: string) {
    if (!viewKey || viewKey.length !== 36) {
      throw new BadRequestException('Missing/invalid viewKey');
    }

    const article = await this.articleRepo.findOne({ where: { slug, status: 'PUBLISHED' } });
    if (!article) throw new NotFoundException('Article not found');

    const day = this.todayISODate();

    // +1 view daily
    await this.ensureDailyRow(article.id, day);
    await this.dailyRepo.increment({ articleId: article.id, day }, 'views', 1);

    // unique/day (insert unique key)
    const uniqueCounted = await this.tryInsertUnique(article.id, day, viewKey);
    if (uniqueCounted) {
      await this.dailyRepo.increment({ articleId: article.id, day }, 'uniqueViews', 1);
    }

    // total all time
    await this.articleRepo.increment({ id: article.id }, 'viewsCount', 1);

    return { ok: true, day, uniqueCounted };
  }

  private async ensureDailyRow(articleId: number, day: string) {
    const row = await this.dailyRepo.findOne({ where: { articleId, day } });
    if (!row) {
      await this.dailyRepo.save(this.dailyRepo.create({ articleId, day, views: 0, uniqueViews: 0 }));
    }
  }

  private async tryInsertUnique(articleId: number, day: string, viewKey: string): Promise<boolean> {
    try {
      await this.uniqueRepo.insert({ articleId, day, viewKey });
      return true;
    } catch {
      return false;
    }
  }

  // ---------------- admin stats ----------------
  async adminStats(articleId: number, days = 30) {
    const article = await this.articleRepo.findOne({ where: { id: articleId } });
    if (!article) throw new NotFoundException('Article not found');

    const safeDays = Math.max(1, Math.min(365, Number(days || 30)));

    const now = new Date();
    const min = new Date(now);
    min.setDate(min.getDate() - (safeDays - 1));

    const yyyy = min.getFullYear();
    const mm = String(min.getMonth() + 1).padStart(2, '0');
    const dd = String(min.getDate()).padStart(2, '0');
    const fromDay = `${yyyy}-${mm}-${dd}`;
    const toDay = this.todayISODate();

    const rows = await this.dailyRepo
      .createQueryBuilder('d')
      .select(['d.day AS day', 'd.views AS views', 'd.uniqueViews AS uniqueViews'])
      .where('d.articleId = :articleId', { articleId })
      .andWhere('d.day BETWEEN :fromDay AND :toDay', { fromDay, toDay })
      .orderBy('d.day', 'ASC')
      .getRawMany<{ day: string; views: number; uniqueViews: number }>();

    const totalViewsPeriod = rows.reduce((s, r) => s + Number(r.views || 0), 0);
    const totalUniquePeriod = rows.reduce((s, r) => s + Number(r.uniqueViews || 0), 0);

    return {
      articleId,
      days: safeDays,
      fromDay,
      toDay,
      totalViewsAllTime: article.viewsCount,
      totalViewsPeriod,
      totalUniquePeriod,
      daily: rows.map((r) => ({
        day: r.day,
        views: Number(r.views || 0),
        uniqueViews: Number(r.uniqueViews || 0),
      })),
    };
  }
}
