import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import OpenAI from 'openai';

import { AiUsage } from './entities/ai-usage.entity';
import { AnalyzeAquariumDto } from './dto/analyze-aquarium.dto';

import { Aquarium } from '../aquariums/aquariums.entity';
import { WaterMeasurement } from '../water-measurement/water-measurement.entity';
import { UsersService } from '../users/users.service';
import { AnalyzePhotoDto } from './dto/analyze-photo.dto';
import { TaskType } from '../tasks/task.entity';

type AiSuggestedTask = {
  type: TaskType;
  title: string;
  description: string;
  suggestedDueAt: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
};

type AiProductRecommendation = {
  id: string;
  name: string;
  url: string;
  reason: string;
  warning: string | null;
  imageUrl: string | null;
};

type CrevettilusCatalogProduct = {
  id: string;
  name: string;
  url: string;
  categories: string;
  description: string;
  inStock: boolean;
  imageUrl: string | null;
};

@Injectable()
export class AiService {
  private readonly openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  private crevettilusCatalogCache: {
    products: CrevettilusCatalogProduct[];
    expiresAt: number;
  } | null = null;

  constructor(
    @InjectRepository(AiUsage)
    private readonly aiUsageRepo: Repository<AiUsage>,

    @InjectRepository(Aquarium)
    private readonly aquariumRepo: Repository<Aquarium>,

    @InjectRepository(WaterMeasurement)
    private readonly measurementRepo: Repository<WaterMeasurement>,

    private readonly usersService: UsersService,
  ) {}

  async analyzeAquarium(
    userId: number,
    aquariumId: number,
    dto: AnalyzeAquariumDto,
  ) {
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Utilisateur invalide');
    }

    if (!Number.isFinite(aquariumId)) {
      throw new BadRequestException('Aquarium invalide');
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new BadRequestException('Clé API OpenAI manquante côté serveur');
    }

    const aquarium = await this.aquariumRepo.findOne({
      where: {
        id: aquariumId,
        user: { id: userId } as any,
      },
      relations: {
        user: true,
      },
    });

    if (!aquarium) {
      throw new NotFoundException('Aquarium introuvable');
    }

    const plan = await this.usersService.getEffectivePlan(userId);
    const feature = 'AQUARIUM_ANALYSIS';
const quota = this.getQuotaByPlan(plan, feature);

const usedThisMonth = await this.countUsageThisMonth(userId, feature);

    if (usedThisMonth >= quota) {
      throw new ForbiddenException(
        `Quota IA atteint pour ce mois-ci (${usedThisMonth}/${quota})`,
      );
    }

    const latestMeasurements = await this.measurementRepo.find({
      where: {
        aquariumId,
      },
      order: {
        measuredAt: 'DESC',
      },
      take: 5,
    });

    const model = this.getModel();

    const question = dto.question || '';
    const wantsProductRecommendations = this.shouldRecommendProducts(question);
    const productCatalog = wantsProductRecommendations
      ? await this.getRelevantCrevettilusProducts(question)
      : [];
    const prompt = this.buildAquariumAnalysisPrompt(
      aquarium,
      latestMeasurements,
      question,
      productCatalog,
    );

    const response = await this.openai.responses.create({
      model,
     instructions: `
Tu es l'assistant aquariophile intelligent d'AquaManager.

Tu réponds aux questions de l'utilisateur en prenant en compte :
- les caractéristiques de son aquarium
- son volume
- son type d'eau
- ses dernières mesures
- la question posée

Réponds en français.
Sois clair, concret et prudent.
Ne donne jamais de certitude absolue si les données sont insuffisantes.
Si une information importante manque, indique ce qu'il faudrait vérifier.

Tu peux aider sur :
- choix d'espèces adaptées
- compatibilité poissons, crevettes et plantes
- analyse des paramètres
- problèmes d'algues
- entretien
- changements d'eau
- fertilisation
- équilibre général du bac

Retourne uniquement un objet JSON valide, sans Markdown :
{
  "analysis": "réponse complète en français",
  "suggestedTasks": [{
    "type": "WATER_CHANGE | FERTILIZATION | TRIM | WATER_TEST | OTHER",
    "title": "titre court",
    "description": "action concrète et prudente",
    "suggestedDueAt": "date ISO 8601 ou null",
    "priority": "LOW | MEDIUM | HIGH",
    "reason": "raison fondée sur les données du bac"
  }],
  "productRecommendations": [{
    "id": "identifiant exact du catalogue Le Crevettilus",
    "reason": "pourquoi ce produit peut être pertinent dans ce cas précis"
  }]
}
Propose au maximum 3 tâches, uniquement si elles sont réellement utiles.
Tu peux aussi proposer jusqu'à 8 références parmi le catalogue Le Crevettilus fourni dans la question. Cela peut inclure des animaux vivants, plantes, engrais, nourritures, traitements, sols ou matériels si cela répond réellement au besoin.
Pour chaque produit, recopie uniquement son identifiant exact et donne une raison personnalisée et prudente. N'invente aucun produit, prix, disponibilité, dosage ou lien. Vérifie la compatibilité avec le volume, le type d'eau, les habitants et les paramètres connus. Si aucun produit n'est nécessaire, retourne un tableau vide.
${wantsProductRecommendations
  ? "L'utilisateur a exprimé un besoin pouvant justifier des références du catalogue. Ne propose néanmoins que des produits réellement utiles."
  : "L'utilisateur demande une analyse ou des priorités, pas des produits. Retourne impérativement productRecommendations: [] et concentre-toi sur le diagnostic et les actions."}
La date actuelle est ${new Date().toISOString()}.
N'invente jamais une mesure absente.
`.trim(),
      input: prompt,
      max_output_tokens: 1800,
    });

    const responseText =
      response.output_text?.trim() || 'Impossible de générer une analyse IA.';
    const parsed = this.parseStructuredResponse(
      responseText,
      productCatalog,
      question,
    );

    const usage = (response as any).usage;

    const inputTokens = usage?.input_tokens ?? 0;
    const outputTokens = usage?.output_tokens ?? 0;
    const totalTokens = usage?.total_tokens ?? inputTokens + outputTokens;

    await this.aiUsageRepo.save(
      this.aiUsageRepo.create({
        userId,
        aquariumId,
        feature,
        plan,
        model,
        inputTokens,
        outputTokens,
        totalTokens,
        responseText: parsed.analysis,
      }),
    );

    return {
      model,
      plan,
      quota,
      used: usedThisMonth + 1,
      remaining: Math.max(quota - usedThisMonth - 1, 0),
      analysis: parsed.analysis,
      suggestedTasks: parsed.suggestedTasks,
      productRecommendations: parsed.productRecommendations,
    };
  }

  private getModel(): string {
    return process.env.OPENAI_MODEL_LUNA || 'gpt-5.6-luna';
  }

  private getQuotaByPlan(plan: string, feature: string): number {
  if (feature === 'AQUARIUM_PHOTO_ANALYSIS') {
    if (plan === 'PRO') return 30;
    if (plan === 'PREMIUM') return 5;
    return 0;
  }

  if (plan === 'PRO') return 100;
  if (plan === 'PREMIUM') return 30;
  return 1;
}

  private parseStructuredResponse(
    responseText: string,
    catalogProducts: CrevettilusCatalogProduct[] = [],
    recommendationQuery = '',
  ): {
    analysis: string;
    suggestedTasks: AiSuggestedTask[];
    productRecommendations: AiProductRecommendation[];
  } {
    const cleaned = responseText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      const parsed = JSON.parse(cleaned);
      const analysis =
        typeof parsed?.analysis === 'string' && parsed.analysis.trim()
          ? parsed.analysis.trim()
          : responseText;
      const allowedTypes = new Set<string>(Object.values(TaskType));
      const allowedPriorities = new Set(['LOW', 'MEDIUM', 'HIGH']);
      const suggestedTasks = (Array.isArray(parsed?.suggestedTasks)
        ? parsed.suggestedTasks
        : []
      )
        .slice(0, 3)
        .filter(
          (task: any) =>
            allowedTypes.has(task?.type) &&
            typeof task?.title === 'string' &&
            task.title.trim().length > 0 &&
            typeof task?.reason === 'string' &&
            task.reason.trim().length > 0,
        )
        .map((task: any): AiSuggestedTask => {
          const rawDate =
            typeof task.suggestedDueAt === 'string'
              ? new Date(task.suggestedDueAt)
              : null;
          return {
            type: task.type as TaskType,
            title: task.title.trim().slice(0, 200),
            description:
              typeof task.description === 'string'
                ? task.description.trim().slice(0, 2000)
                : task.reason.trim().slice(0, 2000),
            suggestedDueAt:
              rawDate && !Number.isNaN(rawDate.getTime())
                ? rawDate.toISOString()
                : null,
            priority: allowedPriorities.has(task.priority)
              ? task.priority
              : 'MEDIUM',
            reason: task.reason.trim().slice(0, 1000),
          };
        });

      const dynamicCatalog = new Map(
        catalogProducts.map((product) => [product.id, product]),
      );
      let productRecommendations = (Array.isArray(parsed?.productRecommendations)
        ? parsed.productRecommendations
        : [])
        .slice(0, 8)
        .map((item: any) => {
          const product = dynamicCatalog.get(String(item?.id || ''));
          const reason = typeof item?.reason === 'string' ? item.reason.trim() : '';
          return product && reason
            ? {
                id: product.id,
                name: product.name,
                url: product.url,
                reason: reason.slice(0, 500),
                warning: 'Vérifier la disponibilité, la compatibilité et le mode d’emploi sur la fiche avant achat ou utilisation.',
                imageUrl: product.imageUrl,
              }
            : null;
        })
        .filter((item: AiProductRecommendation | null): item is AiProductRecommendation => !!item);

      if (!productRecommendations.length) {
        productRecommendations = this.buildFallbackProductRecommendations(
          recommendationQuery,
          catalogProducts,
        );
      }

      return { analysis, suggestedTasks, productRecommendations };
    } catch {
      return {
        analysis: this.extractAnalysisFromPartialJson(responseText),
        suggestedTasks: [],
        productRecommendations: this.buildFallbackProductRecommendations(
          recommendationQuery,
          catalogProducts,
        ),
      };
    }
  }

  private extractAnalysisFromPartialJson(responseText: string): string {
    const cleaned = String(responseText || '')
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const match = cleaned.match(/"analysis"\s*:\s*("(?:\\.|[^"\\])*")/s);
    if (match?.[1]) {
      try {
        const extracted = JSON.parse(match[1]);
        if (typeof extracted === 'string' && extracted.trim()) return extracted.trim();
      } catch {}
    }
    return cleaned
      .replace(/^\s*\{\s*"analysis"\s*:\s*"?/i, '')
      .split(/"\s*,\s*"suggestedTasks"/i)[0]
      .replace(/["},\s]+$/, '')
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .trim();
  }

  private buildFallbackProductRecommendations(
    query: string,
    products: CrevettilusCatalogProduct[],
  ): AiProductRecommendation[] {
    const normalized = this.normalizeCatalogText(query);
    const intents: Array<{ pattern: RegExp; keywords: string[]; label: string }> = [
      {
        pattern: /\b(nourriture|nourrir|aliment|pellet|stick|repas)\b/,
        keywords: ['nourriture', 'aliment', 'pellet', 'stick', 'food'],
        label: 'Cette référence correspond à la demande de nourriture formulée pour les habitants du bac.',
      },
      {
        pattern: /\b(engrais|fertilis|carence|plante)\b/,
        keywords: ['engrais', 'fertilis', 'plante', 'fer', 'potassium'],
        label: 'Cette référence correspond au besoin de fertilisation ou d’entretien des plantes évoqué.',
      },
      {
        pattern: /\b(maladie|traitement|parasite|planaire|hydre|scutariella|urgence)\b/,
        keywords: ['traitement', 'maladie', 'parasite', 'planaire', 'hydre', 'scutariella', 'pharmacie'],
        label: 'Cette référence peut être pertinente pour le problème sanitaire évoqué, après confirmation des symptômes.',
      },
      {
        pattern: /\b(filtre|filtration|pompe|materiel|epuisette|chauffage)\b/,
        keywords: ['filtre', 'filtration', 'pompe', 'materiel', 'chauffage'],
        label: 'Ce matériel correspond au besoin décrit pour l’équipement de l’aquarium.',
      },
      {
        pattern: /\b(crevette|poisson|ecrevisse|escargot|vivant|espece)\b/,
        keywords: ['crevette', 'poisson', 'ecrevisse', 'escargot'],
        label: 'Ce vivant fait partie des références susceptibles de correspondre à la population recherchée.',
      },
    ];
    const intent = intents.find((candidate) => candidate.pattern.test(normalized));
    if (!intent || !products.length) return [];

    const subjectTokens = normalized
      .split(/\s+/)
      .filter((token) => token.length >= 4 && !intent.keywords.some((keyword) => token.includes(keyword)));

    return products
      .map((product) => {
        const haystack = this.normalizeCatalogText(
          `${product.name} ${product.categories} ${product.description}`,
        );
        const intentScore = intent.keywords.reduce(
          (score, keyword) => score + (haystack.includes(keyword) ? 5 : 0),
          0,
        );
        const subjectScore = subjectTokens.reduce(
          (score, token) => score + (haystack.includes(token) ? 4 : 0),
          0,
        );
        return { product, score: intentScore + subjectScore };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ product }) => ({
        id: product.id,
        name: product.name,
        url: product.url,
        reason: intent.label,
        warning: 'Vérifier la disponibilité, la composition, la compatibilité et le mode d’emploi sur la fiche produit.',
        imageUrl: product.imageUrl,
      }));
  }

private async countUsageThisMonth(
  userId: number,
  feature: string,
): Promise<number> {
  const now = new Date();

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);

  return this.aiUsageRepo.count({
    where: {
      userId,
      feature,
      createdAt: Between(start, end),
    },
  });
}

  private buildAquariumAnalysisPrompt(
    aquarium: Aquarium,
    measurements: WaterMeasurement[],
    question?: string,
    productCatalog: CrevettilusCatalogProduct[] = [],
  ): string {
    const formattedMeasurements = measurements.length
      ? measurements
          .map((m, index) => {
            return `
Mesure ${index + 1} :
- Date : ${m.measuredAt}
- pH : ${m.ph ?? 'non renseigné'}
- Température : ${m.temp ?? 'non renseigné'}
- KH : ${m.kh ?? 'non renseigné'}
- GH : ${m.gh ?? 'non renseigné'}
- NO2 : ${m.no2 ?? 'non renseigné'}
- NO3 : ${m.no3 ?? 'non renseigné'}
- PO4 : ${m.po4 ?? 'non renseigné'}
- Fe : ${m.fe ?? 'non renseigné'}
- K : ${m.k ?? 'non renseigné'}
- SiO2 : ${m.sio2 ?? 'non renseigné'}
- NH3/NH4 : ${m.nh3 ?? 'non renseigné'}
- Salinité : ${m.salinity ?? 'non renseigné'}
- Ca : ${m.ca ?? 'non renseigné'}
- Mg : ${m.mg ?? 'non renseigné'}
            `.trim();
          })
          .join('\n\n')
      : 'Aucune mesure récente disponible.';

    return `
Analyse l'aquarium suivant.

Aquarium :
- Nom : ${(aquarium as any).name ?? 'non renseigné'}
- Type d'eau : ${(aquarium as any).waterType ?? 'non renseigné'}
- Volume : ${(aquarium as any).volumeL ?? 'non renseigné'} L
- Longueur : ${(aquarium as any).lengthCm ?? 'non renseigné'} cm
- Largeur : ${(aquarium as any).widthCm ?? 'non renseigné'} cm
- Hauteur : ${(aquarium as any).heightCm ?? 'non renseigné'} cm

Dernières mesures :
${formattedMeasurements}

Question utilisateur :
${question?.trim() || 'Fais une analyse générale de cet aquarium.'}

Catalogue actuel Le Crevettilus pouvant être recommandé :
${this.formatCatalogForPrompt(productCatalog)}
    `.trim();
  }

  //photo
  async analyzeAquariumPhoto(
  userId: number,
  aquariumId: number,
  image: Express.Multer.File,
  dto: AnalyzePhotoDto,
) {
  if (!Number.isFinite(userId)) {
    throw new BadRequestException('Utilisateur invalide');
  }

  if (!Number.isFinite(aquariumId)) {
    throw new BadRequestException('Aquarium invalide');
  }

  if (!image) {
    throw new BadRequestException('Image manquante');
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new BadRequestException('Clé API OpenAI manquante côté serveur');
  }

  const aquarium = await this.aquariumRepo.findOne({
    where: {
      id: aquariumId,
      user: { id: userId } as any,
    },
    relations: {
      user: true,
    },
  });

  if (!aquarium) {
    throw new NotFoundException('Aquarium introuvable');
  }

  const plan = await this.usersService.getEffectivePlan(userId);
  const feature = 'AQUARIUM_PHOTO_ANALYSIS';
  const quota = this.getQuotaByPlan(plan, feature);

  if (quota <= 0) {
    throw new ForbiddenException(
      'Analyse photo réservée aux abonnements Premium et Pro.',
    );
  }

  const usedThisMonth = await this.countUsageThisMonth(userId, feature);

  if (usedThisMonth >= quota) {
    throw new ForbiddenException(
      `Quota analyse photo atteint pour ce mois-ci (${usedThisMonth}/${quota})`,
    );
  }

  const latestMeasurements = await this.measurementRepo.find({
    where: {
      aquariumId,
    },
    order: {
      measuredAt: 'DESC',
    },
    take: 5,
  });

  const model = this.getModel();

  const imageBase64 = image.buffer.toString('base64');
  const imageDataUrl = `data:${image.mimetype};base64,${imageBase64}`;

  const productCatalog = await this.getRelevantCrevettilusProducts(
    `${dto.problemType || ''} ${dto.question || ''}`,
  );
  const prompt = this.buildAquariumPhotoPrompt(
    aquarium,
    latestMeasurements,
    dto.problemType,
    dto.question,
    productCatalog,
  );

  let response;

  try {
    response = await this.openai.responses.create({
      model,
      instructions: `
Tu es un assistant aquariophile intégré à AquaManager.
Tu analyses une photo d'aquarium, d'algue, de plante, de poisson ou d'eau trouble.

Réponds en français.
Sois clair, prudent et actionnable.
Ne donne jamais de diagnostic certain.
Donne des hypothèses probables avec un niveau de confiance.
Si la photo n'est pas assez claire, dis-le.

IMPORTANT :
- N'utilise pas de Markdown.
- N'utilise pas de titres avec ##.
- N'utilise pas de texte en gras avec **.
- Fais une mise en forme simple.
- Saute une ligne entre chaque section.

Structure obligatoire :

1. Observation de la photo
Décris ce que tu vois.

2. Hypothèse principale
Indique le problème probable et le niveau de confiance : faible, moyen ou élevé.

3. Causes possibles
Explique les causes probables en lien avec l'aquarium.

4. Solution conseillée
Donne des actions concrètes et réalistes.

5. À éviter
Liste les erreurs à ne pas faire.

6. Question utilisateur
Réponds précisément à la question posée si elle existe.

Retourne uniquement un objet JSON valide, sans Markdown :
{
  "analysis": "observation, hypothèses prudentes, causes, solutions et points à éviter",
  "suggestedTasks": [{
    "type": "WATER_CHANGE | FERTILIZATION | TRIM | WATER_TEST | OTHER",
    "title": "titre court",
    "description": "action concrète et prudente",
    "suggestedDueAt": "date ISO 8601 ou null",
    "priority": "LOW | MEDIUM | HIGH",
    "reason": "raison fondée sur la photo et les données disponibles"
  }],
  "productRecommendations": [{
    "id": "identifiant exact du catalogue Le Crevettilus",
    "reason": "pourquoi ce produit peut être pertinent dans ce cas précis"
  }]
}
Propose au maximum 3 tâches et seulement si les données les justifient.
Tu peux proposer jusqu'à 8 références parmi le catalogue Le Crevettilus fourni avec la photo : vivant, plante, engrais, nourriture, traitement, sol ou matériel.
Ne recommande un produit que si la photo et les informations rendent son usage pertinent. Recopie uniquement son identifiant exact. N'invente aucun produit, prix, disponibilité, dosage ou lien. Sinon retourne un tableau vide.
La date actuelle est ${new Date().toISOString()}.
      `.trim(),
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: prompt,
            },
            {
              type: 'input_image',
              image_url: imageDataUrl,
              detail: 'low',
            },
          ],
        },
      ],
      max_output_tokens: 1800,
    });
  } catch (e: any) {
    console.error('Erreur OpenAI photo:', e);

    if (e?.code === 'insufficient_quota') {
      throw new BadRequestException(
        'Crédit API OpenAI insuffisant. Ajoute des crédits dans la facturation OpenAI.',
      );
    }

    throw new BadRequestException(
      e?.error?.message ||
        e?.message ||
        "Erreur lors de l'analyse photo par l'IA.",
    );
  }

  const responseText =
    response.output_text?.trim() || 'Impossible de générer une analyse photo.';
  const parsed = this.parseStructuredResponse(
    responseText,
    productCatalog,
    `${dto.problemType || ''} ${dto.question || ''}`,
  );

  const usage = (response as any).usage;

  const inputTokens = usage?.input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;
  const totalTokens = usage?.total_tokens ?? inputTokens + outputTokens;

  await this.aiUsageRepo.save(
    this.aiUsageRepo.create({
      userId,
      aquariumId,
      feature,
      plan,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      responseText: parsed.analysis,
    }),
  );

  return {
    model,
    plan,
    quota,
    used: usedThisMonth + 1,
    remaining: Math.max(quota - usedThisMonth - 1, 0),
    analysis: parsed.analysis,
    suggestedTasks: parsed.suggestedTasks,
    productRecommendations: parsed.productRecommendations,
  };
}

private buildAquariumPhotoPrompt(
  aquarium: Aquarium,
  measurements: WaterMeasurement[],
  problemType?: string,
  question?: string,
  productCatalog: CrevettilusCatalogProduct[] = [],
): string {
  const problemLabel = this.getProblemTypeLabel(problemType);

  const formattedMeasurements = measurements.length
    ? measurements
        .map((m, index) => {
          return `
Mesure ${index + 1} :
- Date : ${m.measuredAt}
- pH : ${m.ph ?? 'non renseigné'}
- Température : ${m.temp ?? 'non renseigné'}
- KH : ${m.kh ?? 'non renseigné'}
- GH : ${m.gh ?? 'non renseigné'}
- NO2 : ${m.no2 ?? 'non renseigné'}
- NO3 : ${m.no3 ?? 'non renseigné'}
- PO4 : ${m.po4 ?? 'non renseigné'}
- Fe : ${m.fe ?? 'non renseigné'}
- K : ${m.k ?? 'non renseigné'}
- SiO2 : ${m.sio2 ?? 'non renseigné'}
- NH3/NH4 : ${m.nh3 ?? 'non renseigné'}
- Salinité : ${m.salinity ?? 'non renseigné'}
- Ca : ${m.ca ?? 'non renseigné'}
- Mg : ${m.mg ?? 'non renseigné'}
          `.trim();
        })
        .join('\n\n')
    : 'Aucune mesure récente disponible.';

  return `
Analyse la photo envoyée par l'utilisateur.

Type de problème sélectionné :
${problemLabel}

Aquarium :
- Nom : ${(aquarium as any).name ?? 'non renseigné'}
- Type d'eau : ${(aquarium as any).waterType ?? 'non renseigné'}
- Volume : ${(aquarium as any).volumeL ?? 'non renseigné'} L
- Longueur : ${(aquarium as any).lengthCm ?? 'non renseigné'} cm
- Largeur : ${(aquarium as any).widthCm ?? 'non renseigné'} cm
- Hauteur : ${(aquarium as any).heightCm ?? 'non renseigné'} cm

Dernières mesures :
${formattedMeasurements}

Question de l'utilisateur :
${question?.trim() || 'Analyse cette photo et donne-moi une solution adaptée.'}

Catalogue actuel Le Crevettilus pouvant être recommandé :
${this.formatCatalogForPrompt(productCatalog)}

Règles :
- Si tu suspectes une algue, précise le type probable : algues pinceaux, filamenteuses, cyano, diatomées, points verts, eau verte ou autre.
- Si tu suspectes une maladie de poisson, reste prudent et recommande de vérifier les symptômes et les paramètres.
- Donne des actions concrètes sans traitement dangereux.
- Si la photo ne suffit pas, demande les informations manquantes.
  `.trim();
}

private async getRelevantCrevettilusProducts(
  query: string,
): Promise<CrevettilusCatalogProduct[]> {
  const products = await this.loadCrevettilusCatalog();
  if (!products.length) return [];

  const normalizedQuery = this.normalizeCatalogText(query);
  const broadRequest = /\b(tout|tous|catalogue|boutique|produits?|disponible|choix)\b/.test(
    normalizedQuery,
  );
  const stopWords = new Set([
    'avec', 'avoir', 'cette', 'dans', 'pour', 'quoi', 'quel', 'quelle', 'sans',
    'sont', 'tous', 'tout', 'une', 'des', 'les', 'mon', 'mes', 'sur', 'site',
    'produit', 'produits', 'propose', 'proposer', 'peux', 'veux', 'aquarium',
  ]);
  const tokens = normalizedQuery
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !stopWords.has(token));

  const ranked = products
    .filter((product) => product.inStock)
    .map((product) => {
      const name = this.normalizeCatalogText(product.name);
      const categories = this.normalizeCatalogText(product.categories);
      const description = this.normalizeCatalogText(product.description);
      let score = 0;
      for (const token of tokens) {
        if (name.includes(token)) score += 8;
        if (categories.includes(token)) score += 5;
        if (description.includes(token)) score += 2;
      }
      return { product, score };
    })
    .sort((a, b) => b.score - a.score);

  const matched = ranked.filter((item) => item.score > 0);
  if (matched.length && !broadRequest) {
    return matched.slice(0, 80).map((item) => item.product);
  }

  // Pour une demande large, répartit les références entre les catégories
  // au lieu de ne fournir que les produits les plus récents au modèle.
  const selected: CrevettilusCatalogProduct[] = [];
  const categoryCounts = new Map<string, number>();
  for (const { product } of ranked) {
    const primaryCategory = product.categories.split(',')[0]?.trim() || 'Autres';
    const count = categoryCounts.get(primaryCategory) ?? 0;
    if (count >= 4) continue;
    selected.push(product);
    categoryCounts.set(primaryCategory, count + 1);
    if (selected.length >= 80) break;
  }
  return selected;
}

private shouldRecommendProducts(query: string): boolean {
  const normalized = this.normalizeCatalogText(query);
  if (!normalized) return false;

  // Une analyse générale des mesures ou une demande de priorités ne doit pas
  // devenir une proposition commerciale sans besoin produit exprimé.
  const productIntent = /\b(produit|produits|boutique|acheter|achat|commander|catalogue|lecrevettilus|crevettilus)\b/;
  const categoryIntent = /\b(nourriture|nourrir|aliment|alimentation|pellet|stick|engrais|fertilisant|fertilisation|traitement|medicament|conditionneur|bacterie|bacteries|materiel|filtre|filtration|eclairage|lampe|sol|substrat)\b/;
  const recommendationIntent = /\b(conseille|conseiller|recommande|recommander|utiliser|solution|contre)\b/;

  return productIntent.test(normalized)
    || categoryIntent.test(normalized)
    || recommendationIntent.test(normalized);
}

private async loadCrevettilusCatalog(): Promise<CrevettilusCatalogProduct[]> {
  if (this.crevettilusCatalogCache?.expiresAt && this.crevettilusCatalogCache.expiresAt > Date.now()) {
    return this.crevettilusCatalogCache.products;
  }

  try {
    const products: CrevettilusCatalogProduct[] = [];
    for (let page = 1; page <= 10; page++) {
      const response = await fetch(
        `https://lecrevettilus.fr/wp-json/wc/store/v1/products?per_page=100&page=${page}`,
        { signal: AbortSignal.timeout(12_000) },
      );
      if (!response.ok) break;
      const rows = await response.json() as any[];
      if (!Array.isArray(rows) || !rows.length) break;

      for (const row of rows) {
        const url = String(row?.permalink || '');
        if (!this.isAllowedCrevettilusUrl(url)) continue;
        products.push({
          id: `wc_${Number(row.id)}`,
          name: this.cleanCatalogHtml(row.name),
          url,
          categories: Array.isArray(row.categories)
            ? row.categories.map((category: any) => this.cleanCatalogHtml(category?.name)).filter(Boolean).join(', ')
            : '',
          description: this.cleanCatalogHtml(row.short_description || row.description).slice(0, 500),
          inStock: row.is_in_stock !== false,
          imageUrl: this.getAllowedCrevettilusImage(row.images),
        });
      }
      if (rows.length < 100) break;
    }

    this.crevettilusCatalogCache = {
      products,
      expiresAt: Date.now() + 30 * 60 * 1000,
    };
    return products;
  } catch (error) {
    console.warn('Catalogue Le Crevettilus indisponible :', error);
    return this.crevettilusCatalogCache?.products ?? [];
  }
}

private formatCatalogForPrompt(products: CrevettilusCatalogProduct[]): string {
  if (!products.length) return 'Catalogue indisponible : ne recommande aucun produit.';
  return products
    .map((product) =>
      `- ${product.id} | ${product.name} | Catégories : ${product.categories || 'non renseignées'} | ${product.description || 'description non renseignée'}`,
    )
    .join('\n');
}

private cleanCatalogHtml(value: unknown): string {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, '–')
    .replace(/&rsquo;|&#8217;/gi, '’')
    .replace(/\s+/g, ' ')
    .trim();
}

private normalizeCatalogText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

private isAllowedCrevettilusUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['lecrevettilus.fr', 'www.lecrevettilus.fr'].includes(url.hostname);
  } catch {
    return false;
  }
}

private getAllowedCrevettilusImage(images: unknown): string | null {
  if (!Array.isArray(images) || !images.length) return null;
  for (const image of images) {
    for (const candidate of [image?.thumbnail, image?.src]) {
      const value = String(candidate || '');
      if (this.isAllowedCrevettilusUrl(value)) return value;
    }
  }
  return null;
}

private getProblemTypeLabel(problemType?: string): string {
  if (problemType === 'ALGAE') return 'Algue';
  if (problemType === 'FISH_DISEASE') return 'Maladie ou problème poisson';
  if (problemType === 'PLANT_PROBLEM') return 'Problème de plante';
  if (problemType === 'WATER_TROUBLE') return 'Eau trouble ou couleur anormale';
  return 'Autre problème';
}
}
