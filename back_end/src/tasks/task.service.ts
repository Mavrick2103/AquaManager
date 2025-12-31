import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus, TaskType } from './task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Aquarium } from '../aquariums/aquariums.entity';

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task) private readonly repo: Repository<Task>,
    @InjectRepository(Aquarium) private readonly aqRepo: Repository<Aquarium>,
  ) {}

  async findMine(userId: number, month?: string) {
    const qb = this.repo.createQueryBuilder('t')
      .leftJoin('t.user', 'u')
      .leftJoinAndSelect('t.aquarium', 'a')
      .where('u.id = :userId', { userId })
      .orderBy('t.dueAt', 'ASC');

    if (month) {
      const start = new Date(`${month}-01T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + 1);
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
      user: { id: userId } as any,
      aquarium,
      status: TaskStatus.PENDING,
      type: dto.type ?? TaskType.OTHER,
    });
    return this.repo.save(task);
  }

  async update(userId: number, id: number, dto: UpdateTaskDto) {
    const task = await this.repo.findOne({
      where: { id },
      relations: { user: true, aquarium: true },
    });
    if (!task || task.user.id !== userId) throw new NotFoundException();

    if (dto.aquariumId !== undefined) {
      const aq = await this.aqRepo.findOne({
        where: { id: dto.aquariumId, user: { id: userId } },
        relations: { user: true },
        select: { id: true } as any,
      });
      if (!aq) throw new NotFoundException('Aquarium invalide ou non autorisé');
      task.aquarium = aq;
    }
    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.dueAt !== undefined) task.dueAt = new Date(dto.dueAt);
    if (dto.status !== undefined) task.status = dto.status;
    if (dto.type !== undefined) task.type = dto.type;

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
