import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThan, IsNull, Brackets, DataSource } from 'typeorm';
import { readdir, stat, statfs } from 'node:fs/promises';
import { join } from 'node:path';

import { User } from '../users/user.entity';
import { Aquarium } from '../aquariums/aquariums.entity';
import { Task, TaskStatus } from '../tasks/task.entity';
import { WaterMeasurement } from '../water-measurement/water-measurement.entity';
import { Article } from '../articles/entities/article.entity';
import { FishCard } from '../catalog/fish-cards/fish-card.entity';
import { PlantCard } from '../catalog/plant-cards/plant-card.entity';
import { OperationalEvent } from './entities/operational-event.entity';

export type MetricsRange = '1d' | '7d' | '30d' | '365d' | 'all';

type SeriesPoint = { label: string; count: number };
type SubscriptionSeriesPoint = {
  label: string;
  premium: number;
  pro: number;
  total: number;
};

function getFrom(range: MetricsRange): Date | null {
  const now = new Date();

  switch (range) {
    case '1d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      return d;
    }
    case '7d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case '30d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return d;
    }
    case '365d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 365);
      return d;
    }
    case 'all':
    default:
      return null;
  }
}

@Injectable()
export class AdminMetricsService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Aquarium) private readonly aquariumsRepo: Repository<Aquarium>,
    @InjectRepository(Task) private readonly tasksRepo: Repository<Task>,
    @InjectRepository(WaterMeasurement) private readonly measurementsRepo: Repository<WaterMeasurement>,
    @InjectRepository(Article) private readonly articlesRepo: Repository<Article>,
    @InjectRepository(FishCard) private readonly fishCardsRepo: Repository<FishCard>,
    @InjectRepository(PlantCard) private readonly plantCardsRepo: Repository<PlantCard>,
    @InjectRepository(OperationalEvent) private readonly operationalEventsRepo: Repository<OperationalEvent>,
    private readonly dataSource: DataSource,
  ) {}

  private async getInfrastructureHealth() {
    let mysql: 'ok' | 'error' = 'ok';
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      mysql = 'error';
    }

    let disk: { status: 'ok' | 'warning' | 'critical' | 'unknown'; freeBytes: number | null; totalBytes: number | null; usedPercent: number | null } = {
      status: 'unknown', freeBytes: null, totalBytes: null, usedPercent: null,
    };
    try {
      const info = await statfs(process.env.UPLOAD_DIR?.trim() || process.cwd());
      const totalBytes = Number(info.blocks) * Number(info.bsize);
      const freeBytes = Number(info.bavail) * Number(info.bsize);
      const usedPercent = totalBytes > 0 ? Math.round(((totalBytes - freeBytes) / totalBytes) * 100) : 0;
      disk = { status: usedPercent >= 90 ? 'critical' : usedPercent >= 80 ? 'warning' : 'ok', freeBytes, totalBytes, usedPercent };
    } catch {}

    const backupDir = process.env.BACKUP_DIR?.trim() || '/backups';
    let backup: { status: 'ok' | 'warning' | 'critical' | 'unknown'; lastAt: string | null; ageHours: number | null } = {
      status: 'unknown', lastAt: null, ageHours: null,
    };
    try {
      const files = (await readdir(backupDir)).filter((name) => name.endsWith('.sql.gz'));
      const dated = await Promise.all(files.map(async (name) => ({ name, modifiedAt: (await stat(join(backupDir, name))).mtime })));
      dated.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
      if (dated[0]) {
        const ageHours = Math.round(((Date.now() - dated[0].modifiedAt.getTime()) / 3_600_000) * 10) / 10;
        backup = { status: ageHours <= 30 ? 'ok' : ageHours <= 48 ? 'warning' : 'critical', lastAt: dated[0].modifiedAt.toISOString(), ageHours };
      } else {
        backup = { status: 'critical', lastAt: null, ageHours: null };
      }
    } catch {}

    return { mysql, disk, backup };
  }

  private async getOperationalAlerts(from: Date | null) {
    try {
    const qb = this.operationalEventsRepo.createQueryBuilder('event');
    if (from) qb.where('event.createdAt >= :from', { from });

    const rows = await qb
      .select('event.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('event.type')
      .getRawMany<{ type: string; count: string }>();
    const counts = new Map(rows.map((row) => [row.type, Number(row.count)]));

    const recentQb = this.operationalEventsRepo.createQueryBuilder('event');
    if (from) recentQb.where('event.createdAt >= :from', { from });
    const recent = await recentQb.orderBy('event.createdAt', 'DESC').take(5).getMany();

    return {
      trackingAvailable: true,
      apiErrors: counts.get('API_ERROR') ?? 0,
      stripeFailures: counts.get('STRIPE_FAILURE') ?? 0,
      emailFailures: counts.get('EMAIL_FAILURE') ?? 0,
      recent: recent.map((event) => ({ type: event.type, route: event.route, statusCode: event.statusCode, createdAt: event.createdAt })),
    };
    } catch {
      return { trackingAvailable: false, apiErrors: 0, stripeFailures: 0, emailFailures: 0, recent: [] };
    }
  }

  private async getFeatureUsage(from: Date | null) {
    const condition = from ? ' WHERE createdAt >= ?' : '';
    const params = from ? [from] : [];
    const queryOne = async (sql: string, values = params) => {
      try { return (await this.dataSource.query(sql, values))[0] ?? {}; }
      catch { return {}; }
    };

    const [assistant, ai, protocols, calendar, measurements, species] = await Promise.all([
      queryOne(`SELECT COUNT(*) events, COUNT(DISTINCT userId) users FROM feature_usage_events${from ? " WHERE createdAt >= ? AND feature = 'ASSISTANT_OPEN'" : " WHERE feature = 'ASSISTANT_OPEN'"}`),
      queryOne(`SELECT COUNT(*) events, COUNT(DISTINCT userId) users FROM ai_usage${condition}`),
      queryOne(`SELECT COUNT(*) events, COUNT(DISTINCT userId) users FROM tasks${from ? " WHERE createdAt >= ? AND description LIKE '%[AquaManager protocol:%'" : " WHERE description LIKE '%[AquaManager protocol:%'"}`),
      queryOne(`SELECT COUNT(*) events, COUNT(DISTINCT userId) users FROM tasks${condition}`),
      queryOne(`SELECT COUNT(*) events, COUNT(DISTINCT a.userId) users FROM water_measurements m JOIN aquariums a ON a.id = m.aquariumId${from ? ' WHERE m.createdAt >= ?' : ''}`),
      queryOne(`SELECT COUNT(*) events, COUNT(DISTINCT visitorKey) users FROM feature_usage_events${from ? " WHERE createdAt >= ? AND feature IN ('FISH_CARD_VIEW', 'PLANT_CARD_VIEW')" : " WHERE feature IN ('FISH_CARD_VIEW', 'PLANT_CARD_VIEW')"}`),
    ]);

    const normalize = (row: any) => ({ events: Number(row.events ?? 0), users: Number(row.users ?? 0) });
    return {
      assistant: { ...normalize(assistant), detail: "ouvertures volontaires de l'assistant" },
      ai: normalize(ai), protocols: normalize(protocols), calendar: normalize(calendar),
      measurements: normalize(measurements),
      species: { ...normalize(species), detail: 'consultations réelles dédupliquées par fiche' },
    };
  }

  private hasUserCreatedAt(): boolean {
    return this.usersRepo.metadata.columns.some((c) => c.propertyName === 'createdAt');
  }

  private hasUserLastActivityAt(): boolean {
    return this.usersRepo.metadata.columns.some((c) => c.propertyName === 'lastActivityAt');
  }

  async getMetrics(range: MetricsRange) {
    const from = getFrom(range);
    const hasCreatedAt = this.hasUserCreatedAt();

    const [usersTotal, admins, infrastructure, operationalAlerts, featureUsage] = await Promise.all([
      this.usersRepo.count(),
      this.usersRepo.count({ where: { role: 'ADMIN' } as any }),
      this.getInfrastructureHealth(),
      this.getOperationalAlerts(from),
      this.getFeatureUsage(from),
    ]);
    const activeSubscriptionQb = this.usersRepo
  .createQueryBuilder('u')
  .where('u.subscriptionStatus IN (:...statuses)', {
    statuses: ['active', 'trialing'],
  })
  .andWhere('u.subscriptionPlan IN (:...plans)', {
    plans: ['PREMIUM', 'PRO'],
  })
  .andWhere(
    new Brackets((qb) => {
      qb.where('u.subscriptionEndsAt IS NULL').orWhere('u.subscriptionEndsAt >= :now', {
        now: new Date(),
      });
    }),
  );

const [premiumActive, proActive] = await Promise.all([
  activeSubscriptionQb
    .clone()
    .andWhere('u.subscriptionPlan = :premiumPlan', { premiumPlan: 'PREMIUM' })
    .getCount(),

  activeSubscriptionQb
    .clone()
    .andWhere('u.subscriptionPlan = :proPlan', { proPlan: 'PRO' })
    .getCount(),
]);

const subscriptionsTotalActive = premiumActive + proActive;

    // -----------------------
    // Nouveaux users sur période
    // -----------------------
    let newInRange: number | null = null;

    if (!hasCreatedAt) {
      newInRange = null;
    } else if (!from) {
      newInRange = usersTotal; // all
    } else {
      newInRange = await this.usersRepo.count({
        where: { createdAt: MoreThanOrEqual(from) } as any,
      });
    }

    // -----------------------
    // ✅ Actifs sur période = lastActivityAt >= from
    // -----------------------
    const hasLastActivity = this.hasUserLastActivityAt();
    let activeInRange = 0;

    if (!from) {
      activeInRange = usersTotal;
    } else if (!hasLastActivity) {
      activeInRange = 0;
    } else {
      activeInRange = await this.usersRepo.count({
        where: { lastActivityAt: MoreThanOrEqual(from) } as any,
      });
    }

    // -----------------------
    // Utilisateurs récemment connectés.
    // La période suit le filtre sélectionné, sans jamais remonter au-delà de 7 jours.
    // -----------------------
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentActivityFrom = from && from > sevenDaysAgo ? from : sevenDaysAgo;
    const latest = hasLastActivity
      ? await this.usersRepo.find({
          select: ['id', 'fullName', 'email', 'role', 'lastActivityAt'] as any,
          where: { lastActivityAt: MoreThanOrEqual(recentActivityFrom) } as any,
          order: { lastActivityAt: 'DESC' } as any,
          take: 10,
        })
      : [];

    // -----------------------
    // Aquariums
    // -----------------------
    const aquariumsTotal = await this.aquariumsRepo.count();
    const aquariumsCreatedInRange = from
      ? await this.aquariumsRepo.count({ where: { createdAt: MoreThanOrEqual(from) } as any })
      : aquariumsTotal;

    // -----------------------
    // Tasks
    // -----------------------
    const tasksTotal = await this.tasksRepo.count();
    const tasksCreatedInRange = from
      ? await this.tasksRepo.count({ where: { createdAt: MoreThanOrEqual(from) } as any })
      : tasksTotal;

    const doneTotal = await this.tasksRepo.count({
      where: { status: TaskStatus.DONE } as any,
    });

    const doneInRange = from
      ? await this.tasksRepo.count({
          where: { status: TaskStatus.DONE, createdAt: MoreThanOrEqual(from) } as any,
        })
      : doneTotal;

    // -----------------------
    // Measurements
    // -----------------------
    const measurementsTotal = await this.measurementsRepo.count();
    const measurementsCreatedInRange = from
      ? await this.measurementsRepo.count({ where: { createdAt: MoreThanOrEqual(from) } as any })
      : measurementsTotal;

    const inactiveSince = new Date();
    inactiveSince.setDate(inactiveSince.getDate() - 30);

    const [
      unverifiedUsers,
      inactiveUsers,
      overdueTasks,
      pendingArticles,
      pendingFishCards,
      pendingPlantCards,
      publishedArticles,
      approvedFishCards,
      approvedPlantCards,
    ] = await Promise.all([
      this.usersRepo.count({ where: { emailVerifiedAt: IsNull() } as any }),
      this.usersRepo
        .createQueryBuilder('u')
        .where('u.lastActivityAt IS NULL OR u.lastActivityAt < :inactiveSince', { inactiveSince })
        .getCount(),
      this.tasksRepo.count({
        where: { status: TaskStatus.PENDING, dueAt: LessThan(new Date()) } as any,
      }),
      this.articlesRepo.count({ where: { status: 'PENDING_REVIEW' } }),
      this.fishCardsRepo.count({ where: { status: 'PENDING' } as any }),
      this.plantCardsRepo.count({ where: { status: 'PENDING' } as any }),
      this.articlesRepo.count({ where: { status: 'PUBLISHED' } }),
      this.fishCardsRepo.count({ where: { status: 'APPROVED', isActive: true } as any }),
      this.plantCardsRepo.count({ where: { status: 'APPROVED', isActive: true } as any }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      range,
      users: {
        total: usersTotal,
        admins,
        newInRange,
        activeInRange,
        latest,
        note: [
          !hasCreatedAt ? "User n'a pas de createdAt : 'nouveaux utilisateurs' indisponible." : null,
          !this.hasUserLastActivityAt()
            ? "User n'a pas de lastActivityAt : 'utilisateurs actifs' indisponible."
            : null,
        ]
          .filter(Boolean)
          .join(' ') || undefined,
      },
      subscriptions: {
  premiumActive,
  proActive,
  totalActive: subscriptionsTotalActive,
},
      aquariums: {
        total: aquariumsTotal,
        createdInRange: aquariumsCreatedInRange,
      },
      tasks: {
        total: tasksTotal,
        createdInRange: tasksCreatedInRange,
        doneTotal,
        doneInRange,
      },
      measurements: {
        total: measurementsTotal,
        createdInRange: measurementsCreatedInRange,
      },
      attention: {
        unverifiedUsers,
        inactiveUsers,
        overdueTasks,
      },
      moderation: {
        pendingArticles,
        pendingFishCards,
        pendingPlantCards,
        totalPending: pendingArticles + pendingFishCards + pendingPlantCards,
      },
      content: {
        publishedArticles,
        approvedFishCards,
        approvedPlantCards,
      },
      operations: { infrastructure, alerts: operationalAlerts },
      featureUsage,
    };
  }

  // ============================================================
  // ✅ SERIES HELPERS
  // ============================================================

  private buildSeriesConfig(range: MetricsRange, now = new Date()) {
    const sub = (ms: number) => new Date(now.getTime() - ms);

    if (range === '1d') return { buckets: 24, unit: 'hour' as const, start: sub(24 * 60 * 60 * 1000) };
    if (range === '7d') return { buckets: 7, unit: 'day' as const, start: sub(7 * 24 * 60 * 60 * 1000) };
    if (range === '30d') return { buckets: 30, unit: 'day' as const, start: sub(30 * 24 * 60 * 60 * 1000) };
    if (range === '365d') return { buckets: 12, unit: 'month' as const, start: sub(365 * 24 * 60 * 60 * 1000) };

    // all -> dynamique par mois (fallback 12 mois si pas de date min)
    return { buckets: 12, unit: 'month' as const, start: sub(365 * 24 * 60 * 60 * 1000) };
  }

  private pad(n: number) {
    return String(n).padStart(2, '0');
  }

  private labelOf(date: Date, unit: 'hour' | 'day' | 'month') {
    const dd = this.pad(date.getDate());
    const mm = this.pad(date.getMonth() + 1);
    if (unit === 'hour') return `${this.pad(date.getHours())}h`;
    if (unit === 'day') return `${dd}/${mm}`;
    return `${mm}/${String(date.getFullYear()).slice(-2)}`;
  }

  private keyOf(date: Date, unit: 'hour' | 'day' | 'month') {
    const y = date.getFullYear();
    const m = this.pad(date.getMonth() + 1);
    const d = this.pad(date.getDate());
    const h = this.pad(date.getHours());

    if (unit === 'hour') return `${y}-${m}-${d} ${h}:00:00`;
    if (unit === 'day') return `${y}-${m}-${d}`;
    return `${y}-${m}-01`;
  }

  private groupExprOf(unit: 'hour' | 'day' | 'month', columnSql: string) {
    if (unit === 'hour') return `DATE_FORMAT(${columnSql}, '%Y-%m-%d %H:00:00')`;
    if (unit === 'day') return `DATE_FORMAT(${columnSql}, '%Y-%m-%d')`;
    return `DATE_FORMAT(${columnSql}, '%Y-%m-01')`;
  }

  // ============================================================
  // ✅ SERIES : NEW USERS (createdAt)
  // ============================================================
  async getNewUsersSeries(range: MetricsRange): Promise<SeriesPoint[]> {
    const now = new Date();
    const cfg = this.buildSeriesConfig(range, now);
    const hasCreatedAt = this.hasUserCreatedAt();

    if (!hasCreatedAt) return [];

    // range=all -> on recalcule buckets depuis min(createdAt) par mois
    if (range === 'all') {
      const row = await this.usersRepo
        .createQueryBuilder('u')
        .select('MIN(u.createdAt)', 'min')
        .getRawOne<{ min: string | null }>();

      if (row?.min) {
        const min = new Date(row.min);
        if (!Number.isNaN(min.getTime())) {
          const start = new Date(min);
          start.setDate(1);
          start.setHours(0, 0, 0, 0);

          const months =
            (now.getFullYear() - start.getFullYear()) * 12 +
            (now.getMonth() - start.getMonth()) +
            1;

          cfg.buckets = Math.max(1, months);
          cfg.unit = 'month';
          cfg.start = start;
        }
      }
    }

    const groupExpr = this.groupExprOf(cfg.unit, 'u.createdAt');

    const rows: Array<{ g: string; c: string }> = await this.usersRepo
      .createQueryBuilder('u')
      .select(groupExpr, 'g')
      .addSelect('COUNT(*)', 'c')
      .where('u.createdAt >= :start', { start: cfg.start })
      .groupBy('g')
      .orderBy('g', 'ASC')
      .getRawMany();

    const map = new Map<string, number>();
    rows.forEach((r) => map.set(String(r.g), Number(r.c)));

    const series: SeriesPoint[] = [];
    const base = new Date(now);

    for (let i = cfg.buckets - 1; i >= 0; i--) {
      const x = new Date(base);

      if (cfg.unit === 'hour') x.setHours(base.getHours() - i, 0, 0, 0);
      if (cfg.unit === 'day') {
        x.setDate(base.getDate() - i);
        x.setHours(0, 0, 0, 0);
      }
      if (cfg.unit === 'month') {
        x.setMonth(base.getMonth() - i, 1);
        x.setHours(0, 0, 0, 0);
      }

      const key = this.keyOf(x, cfg.unit);
      series.push({ label: this.labelOf(x, cfg.unit), count: map.get(key) ?? 0 });
    }

    return series;
  }

  // ============================================================
  // ✅ SERIES : ACTIVE USERS (lastActivityAt)
  // ============================================================
  async getActiveUsersSeries(range: MetricsRange): Promise<SeriesPoint[]> {
    const now = new Date();
    const cfg = this.buildSeriesConfig(range, now);

    if (!this.hasUserLastActivityAt()) return [];

    // range=all -> buckets depuis min(lastActivityAt) par mois
    if (range === 'all') {
      const row = await this.usersRepo
        .createQueryBuilder('u')
        .select('MIN(u.lastActivityAt)', 'min')
        .getRawOne<{ min: string | null }>();

      if (row?.min) {
        const min = new Date(row.min);
        if (!Number.isNaN(min.getTime())) {
          const start = new Date(min);
          start.setDate(1);
          start.setHours(0, 0, 0, 0);

          const months =
            (now.getFullYear() - start.getFullYear()) * 12 +
            (now.getMonth() - start.getMonth()) +
            1;

          cfg.buckets = Math.max(1, months);
          cfg.unit = 'month';
          cfg.start = start;
        }
      }
    }

    const groupExpr = this.groupExprOf(cfg.unit, 'u.lastActivityAt');

    const rows: Array<{ g: string; c: string }> = await this.usersRepo
      .createQueryBuilder('u')
      .select(groupExpr, 'g')
      .addSelect('COUNT(*)', 'c')
      .where('u.lastActivityAt IS NOT NULL')
      .andWhere('u.lastActivityAt >= :start', { start: cfg.start })
      .groupBy('g')
      .orderBy('g', 'ASC')
      .getRawMany();

    const map = new Map<string, number>();
    rows.forEach((r) => map.set(String(r.g), Number(r.c)));

    const series: SeriesPoint[] = [];
    const base = new Date(now);

    for (let i = cfg.buckets - 1; i >= 0; i--) {
      const x = new Date(base);

      if (cfg.unit === 'hour') x.setHours(base.getHours() - i, 0, 0, 0);
      if (cfg.unit === 'day') {
        x.setDate(base.getDate() - i);
        x.setHours(0, 0, 0, 0);
      }
      if (cfg.unit === 'month') {
        x.setMonth(base.getMonth() - i, 1);
        x.setHours(0, 0, 0, 0);
      }

      const key = this.keyOf(x, cfg.unit);
      series.push({ label: this.labelOf(x, cfg.unit), count: map.get(key) ?? 0 });
    }

    return series;
  }
  // ============================================================
// ✅ SERIES : SUBSCRIPTIONS PREMIUM / PRO
// ============================================================
async getSubscriptionsSeries(range: MetricsRange): Promise<SubscriptionSeriesPoint[]> {
  const now = new Date();
  const cfg = this.buildSeriesConfig(range, now);

  // Pour "all", on prend depuis le premier utilisateur créé
  if (range === 'all') {
    const row = await this.usersRepo
      .createQueryBuilder('u')
      .select('MIN(u.createdAt)', 'min')
      .getRawOne<{ min: string | null }>();

    if (row?.min) {
      const min = new Date(row.min);

      if (!Number.isNaN(min.getTime())) {
        const start = new Date(min);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);

        const months =
          (now.getFullYear() - start.getFullYear()) * 12 +
          (now.getMonth() - start.getMonth()) +
          1;

        cfg.buckets = Math.max(1, months);
        cfg.unit = 'month';
        cfg.start = start;
      }
    }
  }

  const groupExpr = this.groupExprOf(cfg.unit, 'u.createdAt');

  const rows: Array<{
    g: string;
    premium: string;
    pro: string;
  }> = await this.usersRepo
    .createQueryBuilder('u')
    .select(groupExpr, 'g')
    .addSelect(
      `SUM(CASE WHEN u.subscriptionPlan = 'PREMIUM' THEN 1 ELSE 0 END)`,
      'premium',
    )
    .addSelect(
      `SUM(CASE WHEN u.subscriptionPlan = 'PRO' THEN 1 ELSE 0 END)`,
      'pro',
    )
    .where('u.createdAt >= :start', { start: cfg.start })
    .andWhere('u.subscriptionStatus IN (:...statuses)', {
      statuses: ['active', 'trialing'],
    })
    .andWhere('u.subscriptionPlan IN (:...plans)', {
      plans: ['PREMIUM', 'PRO'],
    })
    .andWhere(
      new Brackets((qb) => {
        qb.where('u.subscriptionEndsAt IS NULL').orWhere('u.subscriptionEndsAt >= :now', {
          now,
        });
      }),
    )
    .groupBy('g')
    .orderBy('g', 'ASC')
    .getRawMany();

  const map = new Map<string, { premium: number; pro: number }>();

  rows.forEach((r) => {
    map.set(String(r.g), {
      premium: Number(r.premium ?? 0),
      pro: Number(r.pro ?? 0),
    });
  });

  const series: SubscriptionSeriesPoint[] = [];
  const base = new Date(now);

  for (let i = cfg.buckets - 1; i >= 0; i--) {
    const x = new Date(base);

    if (cfg.unit === 'hour') x.setHours(base.getHours() - i, 0, 0, 0);

    if (cfg.unit === 'day') {
      x.setDate(base.getDate() - i);
      x.setHours(0, 0, 0, 0);
    }

    if (cfg.unit === 'month') {
      x.setMonth(base.getMonth() - i, 1);
      x.setHours(0, 0, 0, 0);
    }

    const key = this.keyOf(x, cfg.unit);
    const value = map.get(key) ?? { premium: 0, pro: 0 };

    series.push({
      label: this.labelOf(x, cfg.unit),
      premium: value.premium,
      pro: value.pro,
      total: value.premium + value.pro,
    });
  }

  return series;
}
}
