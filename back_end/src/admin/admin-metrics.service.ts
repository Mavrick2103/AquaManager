import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';

import { User } from '../users/user.entity';
import { Aquarium } from '../aquariums/aquariums.entity';
import { Task, TaskStatus } from '../tasks/task.entity';
import { WaterMeasurement } from '../water-measurement/water-measurement.entity';

export type MetricsRange = '7d' | '30d' | '365d' | 'all';

function getFrom(range: MetricsRange): Date | null {
  const now = new Date();
  switch (range) {
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
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Aquarium) private aquariumsRepo: Repository<Aquarium>,
    @InjectRepository(Task) private tasksRepo: Repository<Task>,
    @InjectRepository(WaterMeasurement) private measurementsRepo: Repository<WaterMeasurement>,
  ) {}

  private hasUserCreatedAt(): boolean {
    // si tu as bien ajouté @CreateDateColumn() createdAt dans User, ça retourne true.
    // sinon on renverra newInRange = null
    return true;
  }

  async getMetrics(range: MetricsRange) {
    const from = getFrom(range);

    const [usersTotal, admins] = await Promise.all([
      this.usersRepo.count(),
      this.usersRepo.count({ where: { role: 'ADMIN' } as any }),
    ]);

    // Nouveaux users sur période (si createdAt dispo)
    let newInRange: number | null = null;
    if (from && this.hasUserCreatedAt()) {
      newInRange = await this.usersRepo.count({
        where: { createdAt: MoreThanOrEqual(from) } as any,
      });
    }

    // Active users (période) = a créé une task OU une mesure sur la période
    let activeInRange = 0;
    if (from) {
      const taskUsers = await this.tasksRepo
        .createQueryBuilder('t')
        .select('DISTINCT t.userId', 'userId')
        .where('t.createdAt >= :from', { from })
        .getRawMany<{ userId: number }>();

      const measUsers = await this.measurementsRepo
        .createQueryBuilder('m')
        .select('DISTINCT a.userId', 'userId')
        .innerJoin('m.aquarium', 'a')
        .where('m.createdAt >= :from', { from })
        .getRawMany<{ userId: number }>();

      const set = new Set<number>();
      taskUsers.forEach((x) => set.add(Number(x.userId)));
      measUsers.forEach((x) => set.add(Number(x.userId)));
      activeInRange = set.size;
    }

    // Derniers users (toujours)
    // si tu as createdAt, tri par createdAt sinon tri par id
    const latest = await this.usersRepo.find({
      select: ['id', 'fullName', 'email', 'role', 'createdAt'] as any,
      order: this.hasUserCreatedAt()
        ? ({ createdAt: 'DESC' } as any)
        : ({ id: 'DESC' } as any),
      take: 10,
    });

    // Aquariums
    const aquariumsTotal = await this.aquariumsRepo.count();
    const aquariumsCreatedInRange = from
      ? await this.aquariumsRepo.count({ where: { createdAt: MoreThanOrEqual(from) } as any })
      : aquariumsTotal;

    // Tasks
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

    // Measurements
    const measurementsTotal = await this.measurementsRepo.count();
    const measurementsCreatedInRange = from
      ? await this.measurementsRepo.count({
          where: { createdAt: MoreThanOrEqual(from) } as any,
        })
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
        note: this.hasUserCreatedAt()
          ? undefined
          : "User n'a pas de createdAt : 'nouveaux utilisateurs' indisponible.",
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
}
