import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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

  async create(userId: number, dto: CreateAquariumDto) {
    if (!Number.isFinite(userId)) throw new BadRequestException('User id invalide');

    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

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
