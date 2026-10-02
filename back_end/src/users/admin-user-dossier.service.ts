import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource, SelectQueryBuilder } from "typeorm";

type Section = {
  entity: string;
  owner?: string;
  aquarium?: boolean;
  fields: string[];
  order: string;
  subscription?: boolean;
  species?: "fish" | "plant";
};
const fields = (value: string) => value.split(" ");
// Only these business fields can leave the administrator dossier API.
export const DOSSIER_SECTIONS: Record<string, Section> = {
  aquariums: {
    entity: "Aquarium",
    owner: "userId",
    fields: fields(
      "id name waterType lengthCm widthCm heightCm volumeL startDate createdAt archivedAt archiveExpiresAt",
    ),
    order: "createdAt",
  },
  measurements: {
    entity: "WaterMeasurement",
    aquarium: true,
    fields: fields(
      "id aquariumId measuredAt ph temp kh gh no2 no3 po4 fe k sio2 nh3 dkh salinity ca mg comment createdAt",
    ),
    order: "measuredAt",
  },
  tasks: {
    entity: "Task",
    owner: "userId",
    aquarium: true,
    fields: fields(
      "id title description dueAt status createdAt type isRepeat repeatMode repeatEveryWeeks repeatDays repeatEndAt completedOccurrences",
    ),
    order: "createdAt",
  },
  fish: {
    entity: "AquariumFishCard",
    aquarium: true,
    species: "fish",
    fields: fields("id aquariumId count createdAt fishCardId"),
    order: "createdAt",
  },
  plants: {
    entity: "AquariumPlantCard",
    aquarium: true,
    species: "plant",
    fields: fields("id aquariumId count createdAt plantCardId"),
    order: "createdAt",
  },
  targets: {
    entity: "AquariumTargets",
    aquarium: true,
    fields: fields("id aquariumId profileKey targets createdAt updatedAt"),
    order: "updatedAt",
  },
  health: {
    entity: "AquariumHealthScore",
    owner: "userId",
    aquarium: true,
    fields: fields("id aquariumId score status mode detailsJson computedAt"),
    order: "computedAt",
  },
  recommendations: {
    entity: "Recommendation",
    owner: "userId",
    aquarium: true,
    fields: fields(
      "id aquariumId measurementId title message severity status actionType actionPayload decidedAt createdAt",
    ),
    order: "createdAt",
  },
  ai: {
    entity: "AiUsage",
    owner: "userId",
    aquarium: true,
    fields: fields(
      "id aquariumId feature plan model inputTokens outputTokens totalTokens questionText responseText feedback feedbackAt createdAt",
    ),
    order: "createdAt",
  },
  activity: {
    entity: "FeatureUsageEvent",
    owner: "userId",
    fields: fields("id aquariumId feature resourceId createdAt"),
    order: "createdAt",
  },
  subscriptions: {
    entity: "PaypalSubscription",
    owner: "userId",
    fields: fields(
      "id paypalId environment status paidUntil syncedAt createdAt",
    ),
    order: "createdAt",
  },
  payments: {
    entity: "PaypalPayment",
    subscription: true,
    fields: fields(
      "id subscriptionKey paidAt periodEnd reversed confirmationEmailAttemptedAt confirmationEmailSentAt",
    ),
    order: "paidAt",
  },
  billingActions: {
    entity: "PaypalAdminAction",
    subscription: true,
    fields: fields("id subscriptionKey actorId outcome createdAt"),
    order: "createdAt",
  },
  achievements: {
    entity: "UserAchievement",
    owner: "userId",
    fields: fields("id achievementKey title description unlockedAt"),
    order: "unlockedAt",
  },
  missions: {
    entity: "WeeklyMission",
    owner: "userId",
    fields: fields(
      "id title description target progress xpReward status weekStart weekEnd completedAt",
    ),
    order: "weekStart",
  },
  articles: {
    entity: "Article",
    owner: "authorId",
    fields: fields(
      "id title slug excerpt content status viewsCount publishedAt reviewedById reviewedAt rejectReason createdAt updatedAt",
    ),
    order: "createdAt",
  },
  fishCards: {
    entity: "FishCard",
    owner: "createdById",
    fields: fields("id commonName scientificName status createdAt"),
    order: "createdAt",
  },
  plantCards: {
    entity: "PlantCard",
    owner: "createdBy",
    fields: fields("id commonName scientificName status createdAt"),
    order: "createdAt",
  },
};

@Injectable()
export class AdminUserDossierService {
  constructor(private readonly db: DataSource) {}
  private validateId(id: number) {
    if (!Number.isSafeInteger(id) || id < 1)
      throw new BadRequestException("Identifiant utilisateur invalide.");
  }
  private async user(id: number) {
    this.validateId(id);
    const user = await this.db
      .getRepository("User")
      .createQueryBuilder("u")
      .select(
        fields(
          "id fullName email pendingEmail role subscriptionPlan subscriptionStatus subscriptionEndsAt billingProvider paypalSubscriptionId paypalRenewalActive stripeCustomerId stripeSubscriptionId createdAt emailVerifiedAt lastActivityAt",
        ).map((f) => "u." + f),
      )
      .where("u.id = :id", { id })
      .getOne();
    if (!user) throw new NotFoundException("Utilisateur introuvable.");
    return user;
  }
  private query(id: number, key: string): SelectQueryBuilder<any> {
    const spec = DOSSIER_SECTIONS[key];
    if (!Object.prototype.hasOwnProperty.call(DOSSIER_SECTIONS, key))
      throw new BadRequestException("Rubrique inconnue.");
    const q = this.db
      .getRepository(spec.entity)
      .createQueryBuilder("r")
      .select([]);
    for (const field of spec.fields) q.addSelect("r." + field, field);
    if (spec.owner) q.andWhere("r." + spec.owner + " = :owner", { owner: id });
    if (spec.aquarium) {
      q.leftJoin("Aquarium", "a", "a.id = r.aquariumId");
      q.andWhere(
        spec.owner
          ? "(a.userId = :owner OR a.id IS NULL)"
          : "a.userId = :owner",
        { owner: id },
      );
      q.addSelect("a.name", "aquariumName").addSelect(
        "a.archivedAt",
        "aquariumArchivedAt",
      );
      if (key === "tasks") q.addSelect("r.aquariumId", "aquariumId");
    }
    if (spec.subscription) {
      q.innerJoin(
        "PaypalSubscription",
        "s",
        "s.id = r.subscriptionKey",
      ).andWhere("s.userId = :owner", { owner: id });
      q.addSelect("s.paypalId", "paypalId").addSelect(
        "s.environment",
        "environment",
      );
    }
    if (spec.species) {
      const fish = spec.species === "fish";
      q.leftJoin(
        fish ? "FishCard" : "PlantCard",
        "c",
        `c.id = r.${fish ? "fishCardId" : "plantCardId"}`,
      )
        .addSelect("c.commonName", "commonName")
        .addSelect("c.scientificName", "scientificName");
    }
    return q;
  }
  async overview(id: number) {
    const user = await this.user(id);
    const [counts, settings, progress, sessions, archived] = await Promise.all([
      Promise.all(
        Object.keys(DOSSIER_SECTIONS).map(
          async (key) => [key, await this.query(id, key).getCount()] as const,
        ),
      ),
      this.db
        .getRepository("Settings")
        .createQueryBuilder("s")
        .select(
          fields(
            "theme defaultView temperatureUnit volumeUnit notificationsEnabled emailNotifications pushNotifications taskReminders automaticNotifications newsAndUpdates alertsEnabled phMin phMax tempMin tempMax lastMeasurementReminderAt lastTaskReminderDate",
          ).map((f) => "s." + f),
        )
        .where("s.userId = :id", { id })
        .getOne(),
      this.db
        .getRepository("GamificationProfile")
        .createQueryBuilder("g")
        .select(
          fields(
            "level xp currentStreak bestStreak lastActivityDate recentBadgeKey createdAt updatedAt",
          ).map((f) => "g." + f),
        )
        .where("g.userId = :id", { id })
        .getOne(),
      this.db
        .getRepository("AuthSession")
        .createQueryBuilder("s")
        .where("s.userId = :id AND s.expiresAt > :now", { id, now: new Date() })
        .getCount(),
      this.db
        .getRepository("Aquarium")
        .createQueryBuilder("a")
        .where("a.userId = :id AND a.archivedAt IS NOT NULL", { id })
        .getCount(),
    ]);
    return {
      user,
      settings,
      progress,
      counts: Object.fromEntries(counts),
      activeSessions: sessions,
      archivedAquariums: archived,
      generatedAt: new Date().toISOString(),
    };
  }
  async records(
    id: number,
    section: string,
    query: { page?: string; aquariumId?: string },
  ) {
    await this.user(id);
    if (
      Object.values(query).some((v) => typeof v !== "string" && v !== undefined)
    )
      throw new BadRequestException("Filtres invalides.");
    const page = Number(query.page ?? "1");
    const aquariumId = query.aquariumId ? Number(query.aquariumId) : null;
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 100000 ||
      (aquariumId !== null &&
        (!Number.isSafeInteger(aquariumId) || aquariumId < 1))
    )
      throw new BadRequestException("Pagination ou aquarium invalide.");
    const q = this.query(id, section),
      spec = DOSSIER_SECTIONS[section];
    if (aquariumId !== null) {
      if (!spec.aquarium)
        throw new BadRequestException(
          "Cette rubrique ne se filtre pas par aquarium.",
        );
      q.andWhere("r.aquariumId = :aquariumId", { aquariumId });
    }
    const total = await q.clone().getCount();
    const items = await q
      .orderBy("r." + spec.order, "DESC")
      .addOrderBy("r.id", "DESC")
      .offset((page - 1) * 25)
      .limit(25)
      .getRawMany();
    if (section === "tasks" && items.length) {
      const fertilizers = await this.db
        .getRepository("TaskFertilizer")
        .createQueryBuilder("f")
        .select(["f.taskId", "f.name", "f.qty", "f.unit"])
        .where("f.taskId IN (:...ids)", { ids: items.map((i) => i.id) })
        .getMany();
      for (const item of items)
        item.fertilizers = fertilizers.filter(
          (f) => f.taskId === Number(item.id),
        );
    }
    return { items, total, page, pageSize: 25 };
  }
}
