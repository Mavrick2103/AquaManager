import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';

import { Article, ArticleStatus } from './entities/article.entity';
import { Theme } from './entities/theme.entity';
import { ArticleViewDaily } from './entities/article-view-daily.entity';
import { ArticleUniqueView } from './entities/article-unique-view.entity';

import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { slugify } from './utils/slugify';

type AppRole = 'USER' | 'EDITOR' | 'ADMIN' | 'SUPERADMIN';
type AuthedUser = { userId: number; role?: AppRole | string };

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article) private readonly articleRepo: Repository<Article>,
    @InjectRepository(Theme) private readonly themeRepo: Repository<Theme>,
    @InjectRepository(ArticleViewDaily)
    private readonly dailyRepo: Repository<ArticleViewDaily>,
    @InjectRepository(ArticleUniqueView)
    private readonly uniqueRepo: Repository<ArticleUniqueView>,
  ) {}

  // ---------------- auth utils ----------------
  private roleOf(u: AuthedUser): AppRole {
    const r = String(u?.role ?? '').toUpperCase();
    if (r === 'ADMIN' || r === 'SUPERADMIN' || r === 'EDITOR' || r === 'USER') return r as AppRole;
    return 'USER';
  }

  private isAdmin(u: AuthedUser) {
    const r = this.roleOf(u);
    return r === 'ADMIN' || r === 'SUPERADMIN';
  }

  private isEditor(u: AuthedUser) {
    return this.roleOf(u) === 'EDITOR';
  }

  private ensureCanRead(article: Article, me: AuthedUser) {
    if (this.isAdmin(me)) return;
    // editor : uniquement ses articles
    if (this.isEditor(me) && article.authorId === me.userId) return;
    throw new ForbiddenException('Interdit');
  }

  private ensureCanWrite(article: Article, me: AuthedUser) {
    if (this.isAdmin(me)) return;
    if (this.isEditor(me) && article.authorId === me.userId) return;
    throw new ForbiddenException('Interdit');
  }

  // ---------------- date utils ----------------
  private todayISODate(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private fromISODate(days: number): string {
    const safeDays = Math.max(1, Math.min(365, Number(days || 30)));
    const now = new Date();
    const min = new Date(now);
    min.setDate(min.getDate() - (safeDays - 1));

    const yyyy = min.getFullYear();
    const mm = String(min.getMonth() + 1).padStart(2, '0');
    const dd = String(min.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  async listPublishedSlugsForSitemap(): Promise<Array<{ slug: string; lastmod: string }>> {
    const rows = await this.articleRepo.find({
      where: { status: 'PUBLISHED' },
      select: { slug: true, updatedAt: true },
      order: { updatedAt: 'DESC' },
    });

    return rows
      .filter((r) => !!r.slug)
      .map((r) => ({
        slug: r.slug,
        lastmod: new Date(r.updatedAt).toISOString().slice(0, 10),
      }));
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

  private async attachUniqueViewsPeriod<T extends Article>(
    articles: T[],
    days = 30,
  ): Promise<Array<T & { uniqueViewsPeriod: number; periodDays: number }>> {
    const safeDays = Math.max(1, Math.min(365, Number(days || 30)));
    if (!articles?.length) return [];

    const ids = articles.map((a) => a.id).filter(Boolean);
    if (!ids.length) {
      return articles.map((a) => ({ ...a, uniqueViewsPeriod: 0, periodDays: safeDays }));
    }

    const fromDay = this.fromISODate(safeDays);
    const toDay = this.todayISODate();

    const rows = await this.dailyRepo
      .createQueryBuilder('d')
      .select('d.articleId', 'articleId')
      .addSelect('SUM(d.uniqueViews)', 'uniqueViewsPeriod')
      .where('d.articleId IN (:...ids)', { ids })
      .andWhere('d.day BETWEEN :fromDay AND :toDay', { fromDay, toDay })
      .groupBy('d.articleId')
      .getRawMany<{ articleId: number; uniqueViewsPeriod: string }>();

    const map = new Map<number, number>();
    rows.forEach((r) => map.set(Number(r.articleId), Number(r.uniqueViewsPeriod || 0)));

    return articles.map((a) => ({
      ...(a as any),
      uniqueViewsPeriod: map.get(a.id) ?? 0,
      periodDays: safeDays,
    }));
  }

  // ---------------- themes ----------------
  async publicThemes() {
    return this.themeRepo.find({ order: { name: 'ASC' } });
  }

  async listThemes() {
    return this.themeRepo.find({ order: { name: 'ASC' } });
  }

  async createTheme(name: string) {
    const slug = slugify(name);
    const exists = await this.themeRepo.findOne({ where: [{ name }, { slug }] });
    if (exists) throw new BadRequestException('Theme already exists');

    return this.themeRepo.save(this.themeRepo.create({ name, slug }));
  }

  // ---------------- articles (admin/editor list) ----------------
  async adminList(
    params: { q?: string; themeId?: number; status?: string; days?: number },
    me: AuthedUser,
  ) {
    const isAdmin = this.isAdmin(me);
    const isEditor = this.isEditor(me);
    if (!isAdmin && !isEditor) throw new ForbiddenException('Interdit');

    const { q, themeId, status, days = 30 } = params;

    const whereBase: any = {};
    if (themeId) whereBase.themeId = themeId;
    if (status) whereBase.status = status;

    // ✅ Editor ne voit que ses articles
    if (isEditor) whereBase.authorId = me.userId;

    let articles: Article[];

    if (q?.trim()) {
      articles = await this.articleRepo.find({
        where: [
          { ...whereBase, title: Like(`%${q}%`) },
          { ...whereBase, excerpt: Like(`%${q}%`) },
        ],
        order: { updatedAt: 'DESC' },
        relations: ['theme'],
      });
    } else {
      articles = await this.articleRepo.find({
        where: whereBase,
        order: { updatedAt: 'DESC' },
        relations: ['theme'],
      });
    }

    return this.attachUniqueViewsPeriod(articles, days);
  }

  async adminGetById(id: number, me: AuthedUser) {
    const article = await this.articleRepo.findOne({ where: { id }, relations: ['theme'] });
    if (!article) throw new NotFoundException('Article not found');
    this.ensureCanRead(article, me);
    return article;
  }

  // ---------------- workflow ----------------

  /**
   * CREATE :
   * - EDITOR : toujours PENDING_REVIEW
   * - ADMIN : seulement DRAFT ou PUBLISHED
   */
  async createArticle(dto: CreateArticleDto, me: AuthedUser) {
    const isAdmin = this.isAdmin(me);
    const isEditor = this.isEditor(me);
    if (!isAdmin && !isEditor) throw new ForbiddenException('Interdit');

    const theme = await this.themeRepo.findOne({ where: { id: dto.themeId } });
    if (!theme) throw new BadRequestException('Invalid themeId');

    const baseSlug = slugify(dto.title);
    const slug = await this.ensureUniqueSlug(baseSlug);

    let status: ArticleStatus;

    if (isEditor) {
      status = 'PENDING_REVIEW';
    } else {
      const wanted = (dto.status ?? 'DRAFT') as ArticleStatus;
      status = wanted === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
    }

    const article = this.articleRepo.create({
      title: dto.title,
      excerpt: dto.excerpt ?? null,
      content: dto.content,
      coverImageUrl: dto.coverImageUrl ?? null,
      slug,
      themeId: dto.themeId,
      status,
      authorId: me.userId,
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
      reviewedById: null,
      reviewedAt: null,
      rejectReason: null,
    });

    return this.articleRepo.save(article);
  }

  /**
   * UPDATE :
   * - EDITOR : seulement ses articles ; toute modif => PENDING_REVIEW + publishedAt null
   * - ADMIN  : tous les articles ; statut seulement DRAFT ou PUBLISHED
   */
  async updateArticle(id: number, dto: UpdateArticleDto, me: AuthedUser) {
    const isAdmin = this.isAdmin(me);
    const isEditor = this.isEditor(me);
    if (!isAdmin && !isEditor) throw new ForbiddenException('Interdit');

    const article = await this.articleRepo.findOne({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');

    // ✅ ownership pour editor
    this.ensureCanWrite(article, me);

    if (dto.themeId) {
      const theme = await this.themeRepo.findOne({ where: { id: dto.themeId } });
      if (!theme) throw new BadRequestException('Invalid themeId');
    }

    if (dto.title && dto.title !== article.title) {
      const baseSlug = slugify(dto.title);
      article.slug = await this.ensureUniqueSlug(baseSlug, article.id);
    }

    if (isEditor) {
      // ❌ editor ne publie jamais
      if ((dto as any).status === 'PUBLISHED') {
        throw new BadRequestException('Un éditeur ne peut pas publier directement');
      }

      // ✅ toute modif => revalidation
      article.status = 'PENDING_REVIEW';
      article.publishedAt = null;
      article.reviewedById = null;
      article.reviewedAt = null;
      article.rejectReason = null;
    } else {
      // ✅ admin : statut whitelist (DRAFT/PUBLISHED)
      if (dto.status) {
        const wanted = dto.status as ArticleStatus;
        if (wanted === 'PUBLISHED') {
          article.status = 'PUBLISHED';
          if (!article.publishedAt) article.publishedAt = new Date();
        } else {
          article.status = 'DRAFT';
          article.publishedAt = null;
        }
      }
    }

    // champs éditables
    if (dto.title !== undefined) article.title = dto.title;
    if (dto.excerpt !== undefined) article.excerpt = dto.excerpt ?? null;
    if (dto.content !== undefined) article.content = dto.content;
    if (dto.coverImageUrl !== undefined) article.coverImageUrl = dto.coverImageUrl ?? null;
    if (dto.themeId !== undefined) article.themeId = dto.themeId;

    return this.articleRepo.save(article);
  }

  /**
   * SUBMIT : bouton "Envoyer à validation"
   * - EDITOR : uniquement ses articles
   * - ADMIN  : ok
   */
  async submitForReview(id: number, me: AuthedUser) {
    const isAdmin = this.isAdmin(me);
    const isEditor = this.isEditor(me);
    if (!isAdmin && !isEditor) throw new ForbiddenException('Interdit');

    const article = await this.articleRepo.findOne({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');

    this.ensureCanWrite(article, me);

    article.status = 'PENDING_REVIEW';
    article.publishedAt = null;
    article.reviewedById = null;
    article.reviewedAt = null;
    article.rejectReason = null;

    return this.articleRepo.save(article);
  }

  /**
   * APPROVE : admin valide => publish
   */
  async approveArticle(id: number, admin: AuthedUser) {
    if (!this.isAdmin(admin)) throw new ForbiddenException('Interdit');

    const article = await this.articleRepo.findOne({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');
    if (article.status !== 'PENDING_REVIEW') throw new BadRequestException('Article pas en attente');

    article.status = 'PUBLISHED';
    article.publishedAt = new Date();
    article.reviewedById = admin.userId;
    article.reviewedAt = new Date();
    article.rejectReason = null;

    return this.articleRepo.save(article);
  }

  /**
   * REJECT : admin refuse (avec raison)
   */
  async rejectArticle(id: number, reason: string, admin: AuthedUser) {
    if (!this.isAdmin(admin)) throw new ForbiddenException('Interdit');

    const article = await this.articleRepo.findOne({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');
    if (article.status !== 'PENDING_REVIEW') throw new BadRequestException('Article pas en attente');

    article.status = 'REJECTED';
    article.publishedAt = null;
    article.reviewedById = admin.userId;
    article.reviewedAt = new Date();
    article.rejectReason = (reason ?? '').trim().slice(0, 500) || 'Refusé';

    return this.articleRepo.save(article);
  }

  async deleteArticle(id: number) {
    const res = await this.articleRepo.delete({ id });
    if (!res.affected) throw new NotFoundException('Article not found');
    return { ok: true };
  }

  // ---------------- public ----------------
  async publicList(params: { q?: string; theme?: string; days?: number }) {
    const { q, theme, days = 30 } = params;

    let themeId: number | undefined;
    if (theme) {
      const t = await this.themeRepo.findOne({ where: { slug: theme } });
      if (!t) return [];
      themeId = t.id;
    }

    const baseWhere: any = { status: 'PUBLISHED' };
    if (themeId) baseWhere.themeId = themeId;

    let articles: Article[];

    if (q?.trim()) {
      articles = await this.articleRepo.find({
        where: [
          { ...baseWhere, title: Like(`%${q}%`) },
          { ...baseWhere, excerpt: Like(`%${q}%`) },
        ],
        order: { publishedAt: 'DESC' },
        relations: ['theme'],
      });
    } else {
      articles = await this.articleRepo.find({
        where: baseWhere,
        order: { publishedAt: 'DESC' },
        relations: ['theme'],
      });
    }

    return this.attachUniqueViewsPeriod(articles, days);
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

    await this.ensureDailyRow(article.id, day);
    await this.dailyRepo.increment({ articleId: article.id, day }, 'views', 1);

    const uniqueCounted = await this.tryInsertUnique(article.id, day, viewKey);
    if (uniqueCounted) {
      await this.dailyRepo.increment({ articleId: article.id, day }, 'uniqueViews', 1);
    }

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
  async adminStats(articleId: number, me: AuthedUser, days = 30) {
    const article = await this.articleRepo.findOne({ where: { id: articleId } });
    if (!article) throw new NotFoundException('Article not found');

    // ✅ editor ne peut pas voir stats d’un autre
    this.ensureCanRead(article, me);

    const safeDays = Math.max(1, Math.min(365, Number(days || 30)));

    const fromDay = this.fromISODate(safeDays);
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
