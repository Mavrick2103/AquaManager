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

@Injectable()
export class AiService {
  private readonly openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

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

    const prompt = this.buildAquariumAnalysisPrompt(
      aquarium,
      latestMeasurements,
      dto.question,
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

IMPORTANT :
- N'utilise pas de Markdown.
- N'utilise pas de titres avec ##.
- N'utilise pas de texte en gras avec **.
- Fais une mise en forme simple.
- Saute une ligne entre chaque section.
- Réponds précisément à la question posée.

Structure recommandée :

1. Réponse directe

2. Analyse avec les données du bac

3. Conseils adaptés

4. Points à vérifier
`.trim(),
      input: prompt,
      max_output_tokens: 900,
    });

    const responseText =
      response.output_text?.trim() || 'Impossible de générer une analyse IA.';

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
        responseText,
      }),
    );

    return {
      model,
      plan,
      quota,
      used: usedThisMonth + 1,
      remaining: Math.max(quota - usedThisMonth - 1, 0),
      analysis: responseText,
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

  const prompt = this.buildAquariumPhotoPrompt(
    aquarium,
    latestMeasurements,
    dto.problemType,
    dto.question,
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
      max_output_tokens: 1000,
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
      responseText,
    }),
  );

  return {
    model,
    plan,
    quota,
    used: usedThisMonth + 1,
    remaining: Math.max(quota - usedThisMonth - 1, 0),
    analysis: responseText,
  };
}

private buildAquariumPhotoPrompt(
  aquarium: Aquarium,
  measurements: WaterMeasurement[],
  problemType?: string,
  question?: string,
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

Règles :
- Si tu suspectes une algue, précise le type probable : algues pinceaux, filamenteuses, cyano, diatomées, points verts, eau verte ou autre.
- Si tu suspectes une maladie de poisson, reste prudent et recommande de vérifier les symptômes et les paramètres.
- Donne des actions concrètes sans traitement dangereux.
- Si la photo ne suffit pas, demande les informations manquantes.
  `.trim();
}

private getProblemTypeLabel(problemType?: string): string {
  if (problemType === 'ALGAE') return 'Algue';
  if (problemType === 'FISH_DISEASE') return 'Maladie ou problème poisson';
  if (problemType === 'PLANT_PROBLEM') return 'Problème de plante';
  if (problemType === 'WATER_TROUBLE') return 'Eau trouble ou couleur anormale';
  return 'Autre problème';
}
}