import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as argon2 from 'argon2';
import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { User } from './user.entity';
import { UpdateMeDto } from './dto/update-me.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';

// ⚠️ Ajuste les chemins si besoin
import { Aquarium } from '../aquariums/aquariums.entity';
import { WaterMeasurement } from '../water-measurement/water-measurement.entity';
import { Task } from '../tasks/task.entity';
import { AquariumFishCard } from '../catalog/aquarium-card-pivot/aquarium-fish-card.entity';
import { AquariumPlantCard } from '../catalog/aquarium-card-pivot/aquarium-plant-card.entity';

type MetricsRange = '1d' | '7d' | '30d' | '365d' | 'all';
type NewUsersPoint = { label: string; count: number };

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    @InjectRepository(Aquarium) private readonly aqRepo: Repository<Aquarium>,
    @InjectRepository(WaterMeasurement) private readonly wmRepo: Repository<WaterMeasurement>,
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(AquariumFishCard) private readonly aqFishRepo: Repository<AquariumFishCard>,
    @InjectRepository(AquariumPlantCard) private readonly aqPlantRepo: Repository<AquariumPlantCard>,
  ) {}

  findById(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async updateProfile(userId: number, dto: UpdateMeDto) {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const patch: Partial<User> = {};

    if (dto.fullName !== undefined) {
      const name = dto.fullName.trim();
      if (name.length > 0) patch.fullName = name;
    }

    if (dto.email !== undefined && dto.email !== user.email) {
      const exists = await this.repo.exist({ where: { email: dto.email } });
      if (exists) throw new ConflictException('Email déjà utilisé');
      patch.email = dto.email;
    }

    if (Object.keys(patch).length === 0) return user;

    await this.repo.update({ id: userId }, patch);
    return this.findById(userId);
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await this.repo
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.id = :id', { id: userId })
      .getOne();

    if (!user) return false;

    const ok = await argon2.verify(user.password, currentPassword);
    if (!ok) return false;

    const passwordHash = await argon2.hash(newPassword);
    await this.repo.update({ id: userId }, { password: passwordHash });
    return true;
  }

  async touchActivity(userId: number): Promise<void> {
    if (!Number.isFinite(userId)) return;
    await this.repo.update({ id: userId }, { lastActivityAt: new Date() });
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.email = :email', { email })
      .getOne();
  }

  async create(dto: CreateUserDto): Promise<User> {
    const exists = await this.repo.exist({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email déjà utilisé');

    const password = await argon2.hash(dto.password);

    const fullName = dto.fullName?.trim().length ? dto.fullName.trim() : dto.email.split('@')[0];

    const user = this.repo.create({
      email: dto.email,
      fullName,
      password,
    });

    return this.repo.save(user);
  }

  async deleteById(id: number) {
    await this.repo.delete(id);
  }

  async setEmailVerifyToken(userId: number, tokenHash: string, expiresAt: Date) {
    await this.repo.update(
      { id: userId },
      {
        emailVerifyTokenHash: tokenHash,
        emailVerifyExpiresAt: expiresAt,
        emailVerifiedAt: null,
      },
    );
  }

  async verifyEmailByTokenHash(tokenHash: string) {
    const user = await this.repo
      .createQueryBuilder('u')
      .addSelect('u.emailVerifyTokenHash')
      .addSelect('u.emailVerifyExpiresAt')
      .where('u.emailVerifyTokenHash = :tokenHash', { tokenHash })
      .getOne();

    if (!user) return null;

    if (!user.emailVerifyExpiresAt) return null;
    if (user.emailVerifyExpiresAt.getTime() < Date.now()) return null;

    if (user.emailVerifiedAt) return user;

    await this.repo.update(
      { id: user.id },
      {
        emailVerifiedAt: new Date(),
        emailVerifyTokenHash: null,
        emailVerifyExpiresAt: null,
      },
    );

    return this.findById(user.id);
  }

  async setPasswordResetToken(email: string, tokenHash: string, expiresAt: Date) {
    const user = await this.repo.findOne({ where: { email } });
    if (!user) return null;

    await this.repo.update(
      { id: user.id },
      {
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpiresAt: expiresAt,
      },
    );

    return user;
  }

  async resetPasswordByTokenHash(tokenHash: string, newPassword: string) {
    const user = await this.repo
      .createQueryBuilder('u')
      .addSelect('u.resetPasswordTokenHash')
      .addSelect('u.resetPasswordExpiresAt')
      .addSelect('u.password')
      .where('u.resetPasswordTokenHash = :tokenHash', { tokenHash })
      .getOne();

    if (!user) return null;
    if (!user.resetPasswordExpiresAt) return null;
    if (user.resetPasswordExpiresAt.getTime() < Date.now()) return null;

    const hashed = await argon2.hash(newPassword);

    await this.repo.update(
      { id: user.id },
      {
        password: hashed,
        resetPasswordTokenHash: null,
        resetPasswordExpiresAt: null,
      },
    );

    return this.findById(user.id);
  }

  // ✅ ADMIN: LIST
  async adminList(search?: string) {
    const qb = this.repo.createQueryBuilder('u');

    qb.select([
      'u.id',
      'u.fullName',
      'u.email',
      'u.role',
      'u.createdAt',
      'u.emailVerifiedAt',
      'u.lastActivityAt',
    ]);

    if (search?.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(u.email) LIKE :q OR LOWER(u.fullName) LIKE :q)', { q });
    }

    qb.orderBy('u.createdAt', 'DESC');
    return qb.getMany();
  }

  // ✅ ADMIN: GET ONE
  async adminGetOne(id: number) {
    if (!Number.isFinite(id)) throw new BadRequestException('Id invalide');

    const user = await this.repo
      .createQueryBuilder('u')
      .select([
        'u.id',
        'u.fullName',
        'u.email',
        'u.role',
        'u.createdAt',
        'u.emailVerifiedAt',
        'u.lastActivityAt',
      ])
      .where('u.id = :id', { id })
      .getOne();

    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  // ✅ ADMIN: GET FULL
  async adminGetFull(id: number) {
    if (!Number.isFinite(id)) throw new BadRequestException('Id invalide');

    const user = await this.repo
      .createQueryBuilder('u')
      .select([
        'u.id',
        'u.fullName',
        'u.email',
        'u.role',
        'u.createdAt',
        'u.emailVerifiedAt',
        'u.lastActivityAt',
      ])
      .where('u.id = :id', { id })
      .getOne();

    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const aquariums = await this.aqRepo
      .createQueryBuilder('a')
      .leftJoin('a.user', 'u')
      .select([
        'a.id',
        'a.name',
        'a.waterType',
        'a.startDate',
        'a.createdAt',
        'a.lengthCm',
        'a.widthCm',
        'a.heightCm',
        'a.volumeL',
      ])
      .where('u.id = :id', { id })
      .orderBy('a.createdAt', 'DESC')
      .getMany();

    const aquariumIds = aquariums.map((a) => a.id);

    const measurements = aquariumIds.length
      ? await this.wmRepo.find({
          where: { aquariumId: In(aquariumIds) },
          order: { measuredAt: 'DESC' },
          take: 500,
        })
      : [];

    const tasks = await this.taskRepo.find({
      where: { user: { id } as any },
      order: { createdAt: 'DESC' },
      take: 500,
      relations: ['aquarium'],
    });

    const fish = aquariumIds.length
      ? await this.aqFishRepo.find({
          where: { aquariumId: In(aquariumIds) },
          order: { createdAt: 'DESC' },
          take: 500,
        })
      : [];

    const plants = aquariumIds.length
      ? await this.aqPlantRepo.find({
          where: { aquariumId: In(aquariumIds) },
          order: { createdAt: 'DESC' },
          take: 500,
        })
      : [];

    return { user, aquariums, measurements, fish, plants, tasks };
  }

  async adminUpdate(id: number, dto: AdminUpdateUserDto) {
    if (!Number.isFinite(id)) throw new BadRequestException('Id invalide');

    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const patch: Partial<User> = {};

    if (dto.fullName !== undefined) {
      const name = String(dto.fullName ?? '').trim();
      if (name.length < 2) throw new BadRequestException('Nom invalide');
      patch.fullName = name;
    }

    if (dto.email !== undefined) {
      const email = String(dto.email ?? '').trim().toLowerCase();
      if (!email) throw new BadRequestException('Email invalide');

      if (email !== user.email) {
        const exists = await this.repo.exist({ where: { email } });
        if (exists) throw new ConflictException('Email déjà utilisé');
        patch.email = email;
      }
    }

    if (dto.role !== undefined) {
      patch.role = dto.role;
    }

    if (Object.keys(patch).length === 0) {
      return this.adminGetOne(id);
    }

    await this.repo.update({ id }, patch);
    return this.adminGetOne(id);
  }

  async adminDelete(id: number) {
    if (!Number.isFinite(id)) throw new BadRequestException('Id invalide');

    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    try {
      await this.repo.delete(id);
      return { ok: true };
    } catch (e: any) {
      if (e?.code === 'ER_ROW_IS_REFERENCED_2' || e?.errno === 1451) {
        throw new ConflictException(
          'Impossible de supprimer cet utilisateur : il possède des données liées (ex: aquariums). Supprime ses aquariums avant.',
        );
      }
      throw e;
    }
  }

  // ============================================================
  // ✅ ADMIN METRICS : série "nouveaux users" selon range
  // ============================================================
  async adminNewUsersSeries(range: MetricsRange): Promise<NewUsersPoint[]> {
    const now = new Date();
    const sub = (ms: number) => new Date(now.getTime() - ms);

    // ✅ "all" = depuis le 1er user (par mois)
    let allStart: Date | null = null;
    if (range === 'all') {
      const row = await this.repo
        .createQueryBuilder('u')
        .select('MIN(u.createdAt)', 'min')
        .getRawOne<{ min: string | null }>();

      if (row?.min) {
        const d = new Date(row.min);
        if (!Number.isNaN(d.getTime())) allStart = d;
      }
    }

    const cfg =
      range === '1d'
        ? { buckets: 24, unit: 'hour' as const, start: sub(24 * 60 * 60 * 1000) }
        : range === '7d'
          ? { buckets: 7, unit: 'day' as const, start: sub(7 * 24 * 60 * 60 * 1000) }
          : range === '30d'
            ? { buckets: 30, unit: 'day' as const, start: sub(30 * 24 * 60 * 60 * 1000) }
            : range === '365d'
              ? { buckets: 12, unit: 'month' as const, start: sub(365 * 24 * 60 * 60 * 1000) }
              : (() => {
                  const start = allStart ?? sub(365 * 24 * 60 * 60 * 1000); // fallback si DB vide
                  const startMonth = new Date(start);
                  startMonth.setDate(1);
                  startMonth.setHours(0, 0, 0, 0);

                  const months =
                    (now.getFullYear() - startMonth.getFullYear()) * 12 +
                    (now.getMonth() - startMonth.getMonth()) +
                    1;

                  return { buckets: Math.max(1, months), unit: 'month' as const, start: startMonth };
                })();

    // ✅ IMPORTANT : pas de DATE() (ça casse les clés)
    const groupExpr =
      cfg.unit === 'hour'
        ? "DATE_FORMAT(u.createdAt, '%Y-%m-%d %H:00:00')"
        : cfg.unit === 'day'
          ? "DATE_FORMAT(u.createdAt, '%Y-%m-%d')" // ✅ FIX : clé stable
          : "DATE_FORMAT(u.createdAt, '%Y-%m-01')";

    const rows: Array<{ g: string; c: string }> = await this.repo
      .createQueryBuilder('u')
      .select(groupExpr, 'g')
      .addSelect('COUNT(*)', 'c')
      .where('u.createdAt >= :start', { start: cfg.start })
      .groupBy('g')
      .orderBy('g', 'ASC')
      .getRawMany();

    const map = new Map<string, number>();
    rows.forEach((r) => map.set(String(r.g), Number(r.c)));

    const pad = (n: number) => String(n).padStart(2, '0');

    const labelOf = (date: Date) => {
      const dd = pad(date.getDate());
      const mm = pad(date.getMonth() + 1);
      if (cfg.unit === 'hour') return `${pad(date.getHours())}h`;
      if (cfg.unit === 'day') return `${dd}/${mm}`;
      return `${mm}/${String(date.getFullYear()).slice(-2)}`;
    };

    const series: NewUsersPoint[] = [];
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

      const key =
        cfg.unit === 'hour'
          ? `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:00:00`
          : cfg.unit === 'day'
            ? `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
            : `${x.getFullYear()}-${pad(x.getMonth() + 1)}-01`;

      series.push({ label: labelOf(x), count: map.get(key) ?? 0 });
    }

    return series;
  }
}
