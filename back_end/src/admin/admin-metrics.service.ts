import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../users/user.entity';
import { Aquarium } from '../aquariums/aquariums.entity';
import { Task, TaskStatus } from '../tasks/task.entity';
import { WaterMeasurement } from '../water-measurement/water-measurement.entity';
import { AdminMetricsDto, MetricsRange } from './dto/admin-metrics.dto';

@Injectable()
export class AdminMetricsService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Aquarium) private readonly aquariumsRepo: Repository<Aquarium>,
    @InjectRepository(Task) private readonly tasksRepo: Repository<Task>,
    @InjectRepository(WaterMeasurement) private readonly measurementsRepo: Repository<WaterMeasurement>,
  ) {}

  async getMetrics(range: MetricsRange): Promise<AdminMetricsDto> {
    const now = new Date();

let from: Date | null = null;

if (range === '7d') {
  from = new Date(now);
  from.setDate(from.getDate() - 7);
} else if (range === '30d') {
  from = new Date(now);
  from.setDate(from.getDate() - 30);
}


    const hasUserCreatedAt = this.usersRepo.metadata.columns.some(c => c.propertyName === 'createdAt');

    const [
      usersTotal,
      adminsTotal,
      latestUsers,
      aquariumsTotal,
      tasksTotal,
      tasksDoneTotal,
      measurementsTotal,
    ] = await Promise.all([
      this.usersRepo.count(),
      this.usersRepo.createQueryBuilder('u').where('u.role = :role', { role: 'ADMIN' }).getCount(),
      this.usersRepo.createQueryBuilder('u')
        .select(['u.id', 'u.fullName', 'u.email', 'u.role'])
        .orderBy('u.id', 'DESC')
        .take(5)
        .getMany(),
      this.aquariumsRepo.count(),
      this.tasksRepo.count(),
      this.tasksRepo.createQueryBuilder('t')
        .where('t.status = :done', { done: TaskStatus.DONE })
        .getCount(),
      this.measurementsRepo.count(),
    ]);

    // createdInRange
    const aquariumsCreatedInRange = from
      ? await this.aquariumsRepo.createQueryBuilder('a').where('a.createdAt >= :from', { from }).getCount()
      : aquariumsTotal;

    const tasksCreatedInRange = from
      ? await this.tasksRepo.createQueryBuilder('t').where('t.createdAt >= :from', { from }).getCount()
      : tasksTotal;

    const tasksDoneInRange = from
      ? await this.tasksRepo.createQueryBuilder('t')
          .where('t.status = :done', { done: TaskStatus.DONE })
          .andWhere('t.createdAt >= :from', { from })
          .getCount()
      : tasksDoneTotal;

    const measurementsCreatedInRange = from
      ? await this.measurementsRepo.createQueryBuilder('m').where('m.createdAt >= :from', { from }).getCount()
      : measurementsTotal;

    // new users in range (si User.createdAt existe)
    const usersNewInRange = (from && hasUserCreatedAt)
      ? await this.usersRepo.createQueryBuilder('u').where('u.createdAt >= :from', { from }).getCount()
      : (range === 'all' && hasUserCreatedAt)
        ? usersTotal
        : null;

    // active users in range = activité via tasks + mesures
    const activeViaTasks = from
      ? await this.tasksRepo.createQueryBuilder('t')
          .select('DISTINCT t.userId', 'userId')
          .where('t.createdAt >= :from', { from })
          .getRawMany<{ userId: number }>()
      : await this.tasksRepo.createQueryBuilder('t')
          .select('DISTINCT t.userId', 'userId')
          .getRawMany<{ userId: number }>();

    const activeViaMeasurements = from
      ? await this.measurementsRepo.createQueryBuilder('m')
          .innerJoin('m.aquarium', 'a')
          .innerJoin('a.user', 'u')
          .select('DISTINCT u.id', 'userId')
          .where('m.createdAt >= :from', { from })
          .getRawMany<{ userId: number }>()
      : await this.measurementsRepo.createQueryBuilder('m')
          .innerJoin('m.aquarium', 'a')
          .innerJoin('a.user', 'u')
          .select('DISTINCT u.id', 'userId')
          .getRawMany<{ userId: number }>();

    const activeSet = new Set<number>([
      ...activeViaTasks.map(r => Number((r as any).userId)).filter(Boolean),
      ...activeViaMeasurements.map(r => Number((r as any).userId)).filter(Boolean),
    ]);

    return {
      generatedAt: now.toISOString(),
      range,

      users: {
        total: usersTotal,
        admins: adminsTotal,
        newInRange: usersNewInRange,
        activeInRange: activeSet.size,
        latest: latestUsers.map(u => ({ id: u.id, fullName: u.fullName, email: u.email, role: u.role })),
        note: hasUserCreatedAt ? undefined : "Ajoute User.createdAt pour avoir 'nouveaux utilisateurs' sur 7j/30j.",
      },

      aquariums: { total: aquariumsTotal, createdInRange: aquariumsCreatedInRange },
      tasks: { total: tasksTotal, createdInRange: tasksCreatedInRange, doneTotal: tasksDoneTotal, doneInRange: tasksDoneInRange },
      measurements: { total: measurementsTotal, createdInRange: measurementsCreatedInRange },
    };
  }
}
