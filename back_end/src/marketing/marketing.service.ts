import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import OpenAI, { toFile } from 'openai';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { Cron } from '@nestjs/schedule';
import {
  CreateMarketingPostDto,
  GenerateMarketingPostDto,
  UpdateMarketingPostDto,
} from './dto/marketing-post.dto';
import { MarketingPost, MarketingPostFormat } from './marketing-post.entity';
import { Article } from '../articles/entities/article.entity';
import { User } from '../users/user.entity';
import { MarketingAgentSettings } from './marketing-agent-settings.entity';
import { UpdateMarketingAgentSettingsDto } from './dto/marketing-post.dto';

@Injectable()
export class MarketingService {
  constructor(
    @InjectRepository(MarketingPost)
    private readonly posts: Repository<MarketingPost>,
    @InjectRepository(Article)
    private readonly articles: Repository<Article>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(MarketingAgentSettings)
    private readonly agentSettings: Repository<MarketingAgentSettings>,
  ) {}

  async getAgentSettings() {
    let settings = await this.agentSettings.findOneBy({ id: 1 });
    if (!settings) {
      settings = await this.agentSettings.save(
        this.agentSettings.create({
          id: 1,
          enabled: true,
          cadence: 'WEEKLY',
          dayOfWeek: 1,
          hour: 9,
          minute: 0,
          timezone: 'Europe/Paris',
          lastGeneratedAt: null,
        }),
      );
    }
    return settings;
  }

  async updateAgentSettings(dto: UpdateMarketingAgentSettingsDto) {
    const settings = await this.getAgentSettings();
    Object.assign(settings, dto);
    return this.agentSettings.save(settings);
  }

  list() {
    return this.posts.find({ order: { scheduledAt: 'ASC', createdAt: 'DESC' } });
  }

  create(userId: number, dto: CreateMarketingPostDto) {
    return this.posts.save(
      this.posts.create({
        ...dto,
        mediaUrl: dto.mediaUrl || null,
        sourceUrl: dto.sourceUrl || null,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        status: dto.status ?? 'DRAFT',
        createdById: userId,
        reviewedById: null,
        reviewedAt: null,
        rejectionReason: null,
        generatedByAi: false,
        aiRationale: null,
        instagramMediaId: null,
        publishedAt: null,
      }),
    );
  }

  async generate(
    userId: number,
    dto: GenerateMarketingPostDto,
    generationMode: 'MANUAL' | 'WEEKLY' = 'MANUAL',
    replacePostId?: number,
  ) {
    if (!process.env.OPENAI_API_KEY) {
      throw new BadRequestException('Clé API OpenAI manquante côté serveur');
    }

    const [articles, allRecentPosts] = await Promise.all([
      this.articles.find({
        where: { status: 'PUBLISHED' },
        order: { publishedAt: 'DESC', createdAt: 'DESC' },
        take: 5,
      }),
      this.posts.find({ order: { createdAt: 'DESC' }, take: 200 }),
    ]);
    const recentPosts = replacePostId
      ? allRecentPosts.filter((post) => post.id !== replacePostId)
      : allRecentPosts;

    const format: MarketingPostFormat = dto.format ?? 'CAROUSEL';
    const siteOrigin = (process.env.APP_URL || 'https://aquamanager.fr').replace(/\/+$/, '');
    const context = articles.length
      ? articles
          .map(
            (article) =>
              `- ${article.title}: ${article.excerpt ?? ''} | URL: ${siteOrigin}/articles/${article.slug}`,
          )
          .join('\n')
      : '- Aucun article récent disponible.';
    const previous = recentPosts.length
      ? recentPosts
          .map((post) => `- ${post.title} | ${post.caption.slice(0, 180)}`)
          .join('\n')
      : '- Aucune proposition précédente.';

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    let response;
    try {
      response = await openai.responses.create({
        model: process.env.OPENAI_MODEL_MARKETING || process.env.OPENAI_MODEL_LUNA || 'gpt-5.6-luna',
        instructions: `
Tu es l'agent marketing officiel d'AquaManager, une application française de gestion d'aquarium.
Ta mission est de proposer un contenu Instagram utile et crédible qui montre qu'AquaManager devient indispensable au suivi quotidien d'un aquarium.

Public : aquariophiles débutants, confirmés et professionnels.
Ton : pédagogique, rassurant, concret, jamais agressivement commercial.
Promesse : centraliser les paramètres, l'entretien, les rappels et l'historique afin de garder un bac plus stable.

Règles :
- Réponds uniquement avec un objet JSON valide, sans Markdown.
- N'invente aucune fonctionnalité qui ne figure pas dans le contexte.
- Évite les promesses médicales et les certitudes absolues.
- Commence la légende par une accroche claire.
- Ajoute un appel à l'action vers aquamanager.fr.
- Utilise au maximum 6 hashtags pertinents.
- Pour un REEL, ajoute un script vidéo court et tournable dans la légende.

Format JSON :
{
  "title": "titre interne court",
  "caption": "légende Instagram complète",
  "sourceUrl": "https://aquamanager.fr ou URL d'article du contexte",
  "rationale": "raison concise expliquant pourquoi ce sujet est utile"
}
        `.trim(),
        input: `
Format demandé : ${format}
Sujet demandé par l'administrateur : ${dto.topic?.trim() || 'Choisis le meilleur sujet éditorial de la semaine.'}

Fonctionnalités confirmées :
- création et suivi de plusieurs aquariums
- suivi du pH, GH, KH, NO2, NO3 et de la température
- historique des mesures
- planification des entretiens et rappels
- articles de conseils aquariophiles

Articles récents :
${context}

Sujets déjà proposés, à ne pas répéter :
${previous}
        `.trim(),
        max_output_tokens: 850,
      });
    } catch (error: any) {
      throw new BadRequestException(
        error?.error?.message || error?.message || 'La génération IA a échoué',
      );
    }

    const raw = response.output_text?.trim();
    if (!raw) throw new BadRequestException("L'agent IA n'a produit aucun contenu");

    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    let proposal: any;
    try {
      proposal = JSON.parse(cleaned);
    } catch {
      throw new BadRequestException("La réponse de l'agent IA est invalide");
    }

    if (
      typeof proposal?.title !== 'string' ||
      typeof proposal?.caption !== 'string' ||
      proposal.title.trim().length < 3 ||
      proposal.caption.trim().length < 10
    ) {
      throw new BadRequestException("La proposition de l'agent IA est incomplète");
    }

    const duplicate = this.findDuplicateProposal(
      proposal.title,
      proposal.caption,
      recentPosts,
    );
    if (duplicate) {
      throw new BadRequestException(
        `Proposition refusée par l’anti-doublon : sujet trop proche de « ${duplicate.title} ». Relancez l’agent pour obtenir une autre idée.`,
      );
    }

    const allowedArticleUrls = articles.map((article) => `${siteOrigin}/articles/${article.slug}`);
    const requestedSource =
      typeof proposal.sourceUrl === 'string' ? proposal.sourceUrl.trim() : '';
    const sourceUrl =
      allowedArticleUrls.find((url) => url === requestedSource) ||
      (requestedSource.startsWith(`${siteOrigin}/`) ? requestedSource : siteOrigin);
    const captionWithoutDuplicateLink = proposal.caption
      .trim()
      .replace(/\n*🔗\s*https?:\/\/\S+\s*$/i, '');
    const finalCaption = `${captionWithoutDuplicateLink}\n\n🔗 ${sourceUrl}`.slice(0, 5000);

    const scheduledAt = this.nextEditorialSlot();
    const replacement = replacePostId ? await this.get(replacePostId) : null;
    const replacementSnapshot = replacement ? { ...replacement } : null;
    const postData: Partial<MarketingPost> = {
        title: proposal.title.trim().slice(0, 160),
        caption: finalCaption,
        sourceUrl,
        mediaUrl: null,
        format,
        status: 'PENDING_APPROVAL',
        scheduledAt,
        rejectionReason: null,
        generatedByAi: true,
        aiRationale:
          typeof proposal.rationale === 'string'
            ? `[${generationMode}] ${proposal.rationale.trim()}`.slice(0, 700)
            : `[${generationMode}] Sujet sélectionné par l’agent marketing AquaManager.`,
        createdById: userId,
        reviewedById: null,
        reviewedAt: null,
        instagramMediaId: null,
        publishedAt: null,
      };
    const saved = await this.posts.save(
      replacement
        ? Object.assign(replacement, postData)
        : this.posts.create(postData),
    );

    try {
      return await this.generateImage(saved.id);
    } catch (error) {
      if (replacementSnapshot) {
        await this.posts.save(replacementSnapshot);
      } else {
        await this.posts.remove(saved);
      }
      throw error;
    }
  }

  async revise(id: number, userId: number, instruction: string) {
    const post = await this.get(id);
    return this.generate(
      userId,
      {
        format: post.format,
        topic: [
          `Révise la publication existante intitulée « ${post.title} ».`,
          `Demande de l'administrateur : ${instruction.trim()}.`,
          `Le nouveau contenu doit être réellement différent et corriger cette demande.`,
          post.sourceUrl ? `Conserve comme source pertinente : ${post.sourceUrl}` : '',
        ].filter(Boolean).join(' '),
      },
      'MANUAL',
      post.id,
    );
  }

  async removeGeneratedPost(id: number) {
    const post = await this.get(id);
    if (!post.generatedByAi) {
      throw new BadRequestException(
        'Seules les publications générées par l’IA peuvent être supprimées ici.',
      );
    }
    if (post.status === 'PUBLISHED') {
      throw new BadRequestException(
        'Une publication déjà publiée sur Instagram ne peut pas être supprimée depuis cet écran.',
      );
    }
    await this.posts.remove(post);
    return { deleted: true, id };
  }

  @Cron('* * * * *', { timeZone: 'Europe/Paris' })
  async generateWeeklyProposal(): Promise<void> {
    if (!process.env.OPENAI_API_KEY) return;
    const settings = await this.getAgentSettings();
    if (!settings.enabled) return;

    const now = new Date();
    const zoned = this.scheduleParts(now, settings.timezone);
    if (
      zoned.dayOfWeek !== settings.dayOfWeek ||
      zoned.hour !== settings.hour ||
      zoned.minute !== settings.minute
    ) return;

    const minimumDays =
      settings.cadence === 'MONTHLY' ? 27 : settings.cadence === 'BIWEEKLY' ? 13 : 6;
    if (
      settings.lastGeneratedAt &&
      now.getTime() - new Date(settings.lastGeneratedAt).getTime() <
        minimumDays * 24 * 60 * 60 * 1000
    ) return;

    const startOfWeek = new Date();
    const day = startOfWeek.getDay() || 7;
    startOfWeek.setDate(startOfWeek.getDate() - day + 1);
    startOfWeek.setHours(0, 0, 0, 0);

    const currentWeekPosts = await this.posts.find({
      where: {
        generatedByAi: true,
        createdAt: MoreThanOrEqual(startOfWeek),
      },
      take: 50,
    });
    if (currentWeekPosts.some((post) => post.aiRationale?.startsWith('[WEEKLY]'))) return;

    const admin = await this.users.findOne({
      where: { role: 'ADMIN' },
      order: { id: 'ASC' },
    });
    if (!admin) return;

    try {
      await this.generate(
        admin.id,
        {
          format: 'POST',
          topic: 'Choisis le sujet le plus utile et le moins répétitif pour cette semaine.',
        },
        'WEEKLY',
      );
      settings.lastGeneratedAt = new Date();
      await this.agentSettings.save(settings);
    } catch (error) {
      console.error('Agent marketing hebdomadaire :', error);
    }
  }

  private scheduleParts(date: Date, timezone: string) {
    const weekdayNumbers: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    let formatter: Intl.DateTimeFormat;
    try {
      formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone || 'Europe/Paris',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
    } catch {
      formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Paris',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
    }
    const parts = Object.fromEntries(
      formatter.formatToParts(date).map((part) => [part.type, part.value]),
    );
    return {
      dayOfWeek: weekdayNumbers[parts.weekday] ?? -1,
      hour: Number(parts.hour),
      minute: Number(parts.minute),
    };
  }

  async instagramStatus() {
    const token = process.env.META_INSTAGRAM_ACCESS_TOKEN?.trim();
    if (!token) {
      return { connected: false, username: null, accountId: null };
    }

    const version = process.env.META_GRAPH_VERSION?.trim() || 'v25.0';
    const response = await fetch(
      `https://graph.instagram.com/${version}/me?fields=id,username`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data: any = await response.json();
    if (!response.ok) {
      return {
        connected: false,
        username: null,
        accountId: null,
        error: data?.error?.message || 'Token Instagram invalide ou expiré',
      };
    }

    return {
      connected: Boolean(data?.id),
      username: data?.username ?? null,
      accountId: data?.id ?? null,
    };
  }

  async publishToInstagram(id: number) {
    const post = await this.get(id);
    if (post.status !== 'APPROVED') {
      throw new BadRequestException('La publication doit être approuvée avant sa diffusion');
    }
    if (!post.mediaUrl?.startsWith('https://')) {
      throw new BadRequestException('Un média public HTTPS est obligatoire');
    }
    if (post.format === 'CAROUSEL' || post.format === 'STORY') {
      throw new BadRequestException(
        'La première version publie les images simples et les Reels. Le carrousel et la Story seront ajoutés ensuite.',
      );
    }

    const token = process.env.META_INSTAGRAM_ACCESS_TOKEN?.trim();
    if (!token) {
      throw new BadRequestException('Connexion Instagram non configurée');
    }

    const version = process.env.META_GRAPH_VERSION?.trim() || 'v25.0';
    const identityResponse = await fetch(
      `https://graph.instagram.com/${version}/me?fields=id,username`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const identity: any = await identityResponse.json();
    if (!identityResponse.ok || !identity?.id) {
      throw new BadRequestException(
        identity?.error?.message || 'Le compte Instagram connecté est introuvable',
      );
    }
    const accountId = String(identity.id);
    const base = `https://graph.instagram.com/${version}/${accountId}`;
    const containerPayload: Record<string, string> = {
      caption: post.caption,
    };
    if (post.format === 'REEL') {
      containerPayload.media_type = 'REELS';
      containerPayload.video_url = post.mediaUrl;
    } else {
      containerPayload.image_url = post.mediaUrl;
    }

    const containerResponse = await fetch(`${base}/media`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(containerPayload),
    });
    const containerData: any = await containerResponse.json();
    if (!containerResponse.ok || !containerData?.id) {
      throw new BadRequestException(
        containerData?.error?.message || 'Impossible de préparer le média Instagram',
      );
    }

    if (post.format === 'REEL') {
      await this.waitForInstagramContainer(containerData.id, token, version);
    }

    const publishResponse = await fetch(`${base}/media_publish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ creation_id: containerData.id }),
    });
    const publishData: any = await publishResponse.json();
    if (!publishResponse.ok || !publishData?.id) {
      throw new BadRequestException(
        publishData?.error?.message || 'Instagram a refusé la publication',
      );
    }

    post.status = 'PUBLISHED';
    post.instagramMediaId = String(publishData.id);
    post.publishedAt = new Date();
    return this.posts.save(post);
  }

  async generateImage(id: number) {
    const post = await this.get(id);
    if (!process.env.OPENAI_API_KEY) {
      throw new BadRequestException('Clé API OpenAI manquante côté serveur');
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const configuredLogoPath = process.env.AQUAMANAGER_BRAND_LOGO_PATH?.trim();
    const logoPath = configuredLogoPath
      ? isAbsolute(configuredLogoPath)
        ? configuredLogoPath
        : resolve(process.cwd(), configuredLogoPath)
      : resolve(process.cwd(), '../front_end/web/public/Logo_AquaManger.png');
    let logoBuffer: Buffer;
    try {
      logoBuffer = await readFile(logoPath);
    } catch {
      throw new BadRequestException(
        `Logo AquaManager introuvable. Configurez AQUAMANAGER_BRAND_LOGO_PATH (chemin actuel : ${logoPath}).`,
      );
    }

    const prompt = `
Crée un visuel Instagram carré premium pour AquaManager, une application française de gestion d'aquarium.

Sujet : ${post.title}
Idée du contenu : ${post.caption.slice(0, 1200)}

L'image fournie est le logo officiel AquaManager et constitue la référence de marque obligatoire.

Règles impératives :
- conserver le logo officiel reconnaissable, sans le redessiner, le déformer ni en modifier le texte
- intégrer discrètement ce logo dans une composition professionnelle
- utiliser la palette bleu pétrole #073f48, turquoise #0b8a80, vert d'eau #bdf5e7 et blanc
- représenter précisément le sujet avec une photographie aquariophile réaliste et des pictogrammes simples
- montrer un aquarium sain, de l'eau limpide et des plantes naturelles
- NE PAS créer de page web, de navigateur, d'écran d'ordinateur, de téléphone ou de fausse interface
- NE PAS inventer de tableau de bord, de capture d'écran, de graphique chiffré ou de fonctionnalité
- aucun autre logo, aucune autre marque et aucun filigrane
- aucun texte supplémentaire en dehors du logo officiel
- format carré, lisible sur Instagram, moderne et aéré
    `.trim();

    let result;
    try {
      const officialLogo = await toFile(logoBuffer, 'aquamanager-logo.png', {
        type: 'image/png',
      });
      result = await openai.images.edit({
        model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2',
        image: officialLogo,
        prompt,
        size: '1024x1024',
        quality: 'medium',
        output_format: 'jpeg',
        n: 1,
      });
    } catch (error: any) {
      throw new BadRequestException(
        error?.error?.message || error?.message || 'La génération du visuel a échoué',
      );
    }

    const imageBase64 = result.data?.[0]?.b64_json;
    if (!imageBase64) {
      throw new BadRequestException("L'agent n'a retourné aucune image");
    }

    const uploadRoot =
      process.env.UPLOAD_DIR?.trim() || join(process.cwd(), 'uploads');
    const marketingDir = join(uploadRoot, 'marketing');
    await mkdir(marketingDir, { recursive: true });

    const filename = `post-${post.id}-${Date.now()}.jpg`;
    await writeFile(join(marketingDir, filename), Buffer.from(imageBase64, 'base64'));

    const publicOrigin = (
      process.env.PUBLIC_MEDIA_URL ||
      (process.env.NODE_ENV === 'production'
        ? process.env.APP_URL || 'https://aquamanager.fr'
        : 'http://localhost:3000')
    ).replace(/\/+$/, '');
    post.mediaUrl = `${publicOrigin}/uploads/marketing/${filename}`;
    post.status = 'PENDING_APPROVAL';
    post.reviewedAt = null;
    post.reviewedById = null;
    post.rejectionReason = null;
    return this.posts.save(post);
  }

  async update(id: number, dto: UpdateMarketingPostDto) {
    const post = await this.get(id);
    Object.assign(post, {
      ...dto,
      ...(dto.scheduledAt !== undefined ? { scheduledAt: new Date(dto.scheduledAt) } : {}),
      ...(dto.mediaUrl !== undefined ? { mediaUrl: dto.mediaUrl || null } : {}),
      ...(dto.sourceUrl !== undefined ? { sourceUrl: dto.sourceUrl || null } : {}),
    });
    if (dto.status === 'PENDING_APPROVAL') {
      post.rejectionReason = null;
    }
    return this.posts.save(post);
  }

  async approve(id: number, reviewerId: number) {
    const post = await this.get(id);
    post.status = 'APPROVED';
    post.reviewedById = reviewerId;
    post.reviewedAt = new Date();
    post.rejectionReason = null;
    return this.posts.save(post);
  }

  async reject(id: number, reviewerId: number, reason: string) {
    const post = await this.get(id);
    post.status = 'REJECTED';
    post.reviewedById = reviewerId;
    post.reviewedAt = new Date();
    post.rejectionReason = reason.trim();
    return this.posts.save(post);
  }

  private async get(id: number) {
    const post = await this.posts.findOneBy({ id });
    if (!post) throw new NotFoundException('Publication marketing introuvable');
    return post;
  }

  private nextEditorialSlot(): Date {
    const date = new Date();
    date.setDate(date.getDate() + ((4 - date.getDay() + 7) % 7 || 7));
    date.setHours(18, 0, 0, 0);
    return date;
  }

  private findDuplicateProposal(
    title: string,
    caption: string,
    history: MarketingPost[],
  ): MarketingPost | null {
    const candidateTitle = this.normalizeMarketingText(title);
    const candidateTokens = this.meaningfulTokens(`${title} ${caption}`);

    for (const post of history) {
      const previousTitle = this.normalizeMarketingText(post.title);
      if (candidateTitle === previousTitle) return post;

      const previousTokens = this.meaningfulTokens(`${post.title} ${post.caption}`);
      const intersection = [...candidateTokens].filter((token) => previousTokens.has(token)).length;
      const union = new Set([...candidateTokens, ...previousTokens]).size;
      const similarity = union ? intersection / union : 0;

      const titleContained =
        candidateTitle.length >= 12 &&
        (previousTitle.includes(candidateTitle) || candidateTitle.includes(previousTitle));

      if (titleContained || similarity >= 0.46) return post;
    }

    return null;
  }

  private meaningfulTokens(value: string): Set<string> {
    const ignored = new Set([
      'avec', 'dans', 'pour', 'plus', 'votre', 'vous', 'des', 'les', 'une', 'sur',
      'aqua', 'aquamanager', 'aquarium', 'aquariophilie', 'comment', 'grace', 'sans',
    ]);
    return new Set(
      this.normalizeMarketingText(value)
        .split(' ')
        .filter((token) => token.length >= 4 && !ignored.has(token)),
    );
  }

  private normalizeMarketingText(value: string): string {
    return String(value ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private async waitForInstagramContainer(
    containerId: string,
    token: string,
    version: string,
  ): Promise<void> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await fetch(
        `https://graph.instagram.com/${version}/${containerId}?fields=status_code`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data: any = await response.json();
      if (data?.status_code === 'FINISHED') return;
      if (data?.status_code === 'ERROR' || data?.status_code === 'EXPIRED') {
        throw new BadRequestException('Instagram n’a pas pu traiter la vidéo');
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new BadRequestException('La vidéo est encore en cours de traitement. Réessayez dans un instant.');
  }
}
