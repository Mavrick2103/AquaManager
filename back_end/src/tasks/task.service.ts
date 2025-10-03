import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Aquarium } from '../aquariums/aquariums.entity';
import { User } from '../users/user.entity';

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task) private readonly repo: Repository<Task>,
    @InjectRepository(Aquarium) private readonly aqRepo: Repository<Aquarium>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async findMine(userId: number, month?: string) {
    // month optionnel: "2025-10" -> filtre sur le mois
    const qb = this.repo.createQueryBuilder('t')
      .leftJoin('t.user', 'u')
      .leftJoinAndSelect('t.aquarium', 'a')
      .where('u.id = :userId', { userId })
      .orderBy('t.dueAt', 'ASC');

    if (month) {
      // borne [YYYY-MM-01, mois+1)
      const start = new Date(`${month}-01T00:00:00.000Z`);
      const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
      qb.andWhere('t.dueAt >= :start AND t.dueAt < :end', { start, end });
    }
    return qb.getMany();
  }

  async create(userId: number, dto: CreateTaskDto) {
    const aquarium = await this.aqRepo.findOne({
      where: { id: dto.aquariumId, user: { id: userId } },
      relations: { user: true },
      select: { id: true } as any,
    });
    if (!aquarium) throw new NotFoundException('Aquarium introuvable ou non autorisé');

    const task = this.repo.create({
      title: dto.title,
      description: dto.description,
      dueAt: new Date(dto.dueAt),
      status: 'PENDING',
      type: dto.type ?? 'OTHER',
      user: { id: userId } as any,
      aquarium,
    });
    return this.repo.save(task);
  }


  async update(userId: number, id: number, dto: UpdateTaskDto) {
    const task = await this.repo.findOne({
      where: { id },
      relations: { user: true, aquarium: true },
    });
    if (!task || task.user.id !== userId) throw new NotFoundException();

    if (dto.aquariumId) {
      const aq = await this.aqRepo.findOneBy({ id: dto.aquariumId });
      if (!aq || aq.user?.id !== userId) throw new NotFoundException('Aquarium invalide');
      task.aquarium = aq;
    }
    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.dueAt !== undefined) task.dueAt = new Date(dto.dueAt);
    if (dto.status !== undefined) task.status = dto.status;

    return this.repo.save(task);
  }

  async remove(userId: number, id: number) {
    const task = await this.repo.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!task || task.user.id !== userId) throw new NotFoundException();
    await this.repo.delete(id);
    return { ok: true };
  }
}
