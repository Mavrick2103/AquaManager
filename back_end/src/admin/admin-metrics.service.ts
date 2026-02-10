import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';

import { User } from '../users/user.entity';
import { Aquarium } from '../aquariums/aquariums.entity';
import { Task, TaskStatus } from '../tasks/task.entity';
import { WaterMeasurement } from '../water-measurement/water-measurement.entity';

export type MetricsRange = '1d' | '7d' | '30d' | '365d' | 'all';

type SeriesPoint = { label: string; count: number };

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
  ) {}

  private hasUserCreatedAt(): boolean {
    return this.usersRepo.metadata.columns.some((c) => c.propertyName === 'createdAt');
  }

  private hasUserLastActivityAt(): boolean {
    return this.usersRepo.metadata.columns.some((c) => c.propertyName === 'lastActivityAt');
  }

  async getMetrics(range: MetricsRange) {
    const from = getFrom(range);
    const hasCreatedAt = this.hasUserCreatedAt();

    const [usersTotal, admins] = await Promise.all([
      this.usersRepo.count(),
      this.usersRepo.count({ where: { role: 'ADMIN' } as any }),
    ]);

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
    // Derniers users
    // -----------------------
    const latest = await this.usersRepo.find({
      select: ['id', 'fullName', 'email', 'role', 'createdAt'] as any,
      order: hasCreatedAt ? ({ createdAt: 'DESC' } as any) : ({ id: 'DESC' } as any),
      take: 10,
    });

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
}
