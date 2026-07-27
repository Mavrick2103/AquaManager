import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Aquarium } from './aquariums.entity';
import { CreateAquariumDto } from './dto/create-aquarium.dto';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class AquariumsService {
  constructor(
    @InjectRepository(Aquarium) private readonly repo: Repository<Aquarium>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly usersService: UsersService, // ✅ activity
  ) {}

  // tous les aquariums d’un utilisateur
  async findMine(userId: number) {
    if (!Number.isFinite(userId)) throw new BadRequestException('User id invalide');

    const rows = await this.repo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });

    await this.usersService.touchActivity(userId);
    return rows;
  }

  async getOverview(userId: number) {
    if (!Number.isFinite(userId)) throw new BadRequestException('User id invalide');

    const rows = await this.repo.query(
      `
        SELECT
          a.id,
          a.name,
          a.lengthCm,
          a.widthCm,
          a.heightCm,
          a.volumeL,
          a.waterType,
          a.startDate,
          a.createdAt,
          COALESCE((
            SELECT SUM(af.count)
            FROM aquarium_fish_cards af
            WHERE af.aquariumId = a.id
          ), 0) AS fishCount,
          COALESCE((
            SELECT SUM(ap.count)
            FROM aquarium_plant_cards ap
            WHERE ap.aquariumId = a.id
          ), 0) AS plantCount,
          (
            SELECT MAX(wm.measuredAt)
            FROM water_measurements wm
            WHERE wm.aquariumId = a.id
          ) AS lastMeasuredAt,
          COALESCE((
            SELECT COUNT(*)
            FROM tasks t
            WHERE t.aquariumId = a.id
              AND t.status = 'PENDING'
              AND t.dueAt < NOW()
          ), 0) AS overdueTaskCount,
          (
            SELECT MIN(t.dueAt)
            FROM tasks t
            WHERE t.aquariumId = a.id
              AND t.status = 'PENDING'
              AND t.dueAt >= NOW()
          ) AS nextTaskAt,
          (
            SELECT t.title
            FROM tasks t
            WHERE t.aquariumId = a.id
              AND t.status = 'PENDING'
              AND t.dueAt >= NOW()
            ORDER BY t.dueAt ASC
            LIMIT 1
          ) AS nextTaskTitle,
          (
            SELECT
              (MAX(t.description LIKE '%[AquaManager protocol:ROUTINE]%') +
               MAX(t.description LIKE '%[AquaManager protocol:STARTUP]%') +
               MAX(t.description LIKE '%[AquaManager protocol:ALGAE]%') +
               MAX(t.description LIKE '%[AquaManager protocol:VACATION]%'))
            FROM tasks t
            WHERE t.aquariumId = a.id
              AND t.status = 'PENDING'
          ) AS activeProtocolCount
        FROM aquariums a
        WHERE a.userId = ?
        ORDER BY a.createdAt DESC
      `,
      [userId],
    );

    await this.usersService.touchActivity(userId);
    return rows.map((row: any) => ({
      ...row,
      id: Number(row.id),
      lengthCm: Number(row.lengthCm),
      widthCm: Number(row.widthCm),
      heightCm: Number(row.heightCm),
      volumeL: Number(row.volumeL),
      fishCount: Number(row.fishCount) || 0,
      plantCount: Number(row.plantCount) || 0,
      overdueTaskCount: Number(row.overdueTaskCount) || 0,
      activeProtocolCount: Number(row.activeProtocolCount) || 0,
    }));
  }

  async create(userId: number, dto: CreateAquariumDto) {
    if (!Number.isFinite(userId)) throw new BadRequestException('User id invalide');

    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const effectivePlan = await this.usersService.getEffectivePlan(userId);
    const limit = effectivePlan === 'CLASSIC' ? 2 : effectivePlan === 'PREMIUM' ? 5 : null;

    if (limit !== null) {
      const aquariumCount = await this.repo.count({
        where: { user: { id: userId } },
      });
      if (aquariumCount >= limit) {
        throw new ForbiddenException({
          code: 'AQUARIUM_LIMIT_REACHED',
          message:
            effectivePlan === 'CLASSIC'
              ? 'Le plan Classic permet de créer jusqu’à 2 aquariums.'
              : 'Le plan Premium permet de créer jusqu’à 5 aquariums.',
          plan: effectivePlan,
          limit,
        });
      }
    }

    const volumeL = Math.round((dto.lengthCm * dto.widthCm * dto.heightCm) / 1000);

    const startDate =
      (dto as any).startDate instanceof Date ? (dto as any).startDate : new Date(dto.startDate);

    const aquarium = this.repo.create({
      name: dto.name.trim(),
      lengthCm: dto.lengthCm,
      widthCm: dto.widthCm,
      heightCm: dto.heightCm,
      volumeL,
      waterType: dto.waterType,
      startDate,
      user: { id: userId } as any,
    });

    const saved = await this.repo.save(aquarium);
    await this.usersService.touchActivity(userId);

    return saved;
  }

  async findOne(userId: number, id: number) {
    if (!Number.isFinite(userId)) throw new BadRequestException('User id invalide');
    if (!Number.isFinite(id)) throw new BadRequestException('Aquarium id invalide');

    const a = await this.repo.findOne({
      where: { id, user: { id: userId } },
      relations: { user: true },
    });
    if (!a) throw new NotFoundException('Aquarium introuvable');

    await this.usersService.touchActivity(userId);
    return a;
  }

  async update(userId: number, id: number, dto: Partial<CreateAquariumDto>) {
    if (!Number.isFinite(userId)) throw new BadRequestException('User id invalide');
    if (!Number.isFinite(id)) throw new BadRequestException('Aquarium id invalide');

    const a = await this.findOne(userId, id);

    const lengthCm = dto.lengthCm ?? a.lengthCm;
    const widthCm = dto.widthCm ?? a.widthCm;
    const heightCm = dto.heightCm ?? a.heightCm;

    const volumeL = Math.round((lengthCm * widthCm * heightCm) / 1000);

    const startDate =
      dto.startDate !== undefined
        ? ((dto as any).startDate instanceof Date ? (dto as any).startDate : new Date(dto.startDate as any))
        : a.startDate;

    Object.assign(a, {
      name: dto.name?.trim() ?? a.name,
      lengthCm,
      widthCm,
      heightCm,
      volumeL,
      waterType: dto.waterType ?? a.waterType,
      startDate,
    });

    const saved = await this.repo.save(a);
    await this.usersService.touchActivity(userId);

    return saved;
  }

  async remove(userId: number, id: number) {
    if (!Number.isFinite(userId)) throw new BadRequestException('User id invalide');
    if (!Number.isFinite(id)) throw new BadRequestException('Aquarium id invalide');

    const a = await this.findOne(userId, id);

    await this.repo.remove(a);
    await this.usersService.touchActivity(userId);

    return { ok: true };
  }
}
