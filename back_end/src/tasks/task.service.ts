// src/tasks/task.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Aquarium } from '../aquariums/aquariums.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task, TaskStatus, TaskType, RepeatMode, WeekDayKey } from './task.entity';
import { TaskFertilizer, FertilizerUnit } from './task-fertilizer.entity';
import { UsersService } from '../users/users.service';

type RepeatPayload =
  | null
  | {
      mode: RepeatMode;
      /**
       * optionnel : si absent => répétition indéfinie
       * (repeatEndAt restera null)
       */
      durationWeeks?: number;
      everyWeeks?: number;
      days?: WeekDayKey[];
    };

type FertLine = { name: string; qty: number; unit: FertilizerUnit };

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task) private readonly repo: Repository<Task>,
    @InjectRepository(Aquarium) private readonly aqRepo: Repository<Aquarium>,
    @InjectRepository(TaskFertilizer) private readonly fertRepo: Repository<TaskFertilizer>,
    private readonly usersService: UsersService,
  ) {}

  // =========================
  // Helpers: id parsing
  // =========================
  private parseTaskId(raw: string): number {
    if (!raw) throw new BadRequestException('Missing task id');

    // ids virtuels: r:<baseId>:<dueAtIso>
    if (raw.startsWith('r:')) {
      const parts = raw.split(':');
      if (parts.length < 3) throw new BadRequestException('Invalid recurring task id');
      const baseId = Number(parts[1]);
      if (!Number.isFinite(baseId)) throw new BadRequestException('Invalid recurring task id');
      return baseId;
    }

    const n = Number(raw);
    if (!Number.isFinite(n)) throw new BadRequestException('Invalid task id');
    return n;
  }

  // =========================
  // Helpers: title auto
  // =========================
  private autoTitleForType(type: TaskType): string | null {
    switch (type) {
      case TaskType.WATER_CHANGE:
        return 'Changement d’eau';
      case TaskType.FERTILIZATION:
        return 'Fertilisation';
      case TaskType.TRIM:
        return 'Taille / entretien';
      case TaskType.WATER_TEST:
        return 'Test de l’eau';
      default:
        return null; // OTHER
    }
  }

  // =========================
  // Helpers: repeat end (borne EXCLUSIVE)
  // =========================
  private computeRepeatEndAt(baseDueAt: Date, durationWeeks?: number): Date | null {
    const w = Number(durationWeeks);
    // si durationWeeks absent/NaN/<=0 => pas de fin (répétition indéfinie)
    if (!Number.isFinite(w) || w <= 0) return null;

    // 🔥 borne exclusive : dueAt + (w * 7 jours)
    const end = new Date(baseDueAt);
    end.setUTCDate(end.getUTCDate() + Math.floor(w) * 7);
    return end;
  }

  // =========================
  // Helpers: response mapping
  // =========================
  private toRepeatResponse(t: Task): RepeatPayload {
    if (!t.isRepeat || t.repeatMode === RepeatMode.NONE) return null;

    // durationWeeks = (repeatEndAt - dueAt) / 7j (borne exclusive -> exact en semaines)
    let durationWeeks: number | undefined = undefined;
    if (t.repeatEndAt) {
      const diffMs = t.repeatEndAt.getTime() - t.dueAt.getTime();
      const w = Math.max(1, Math.round(diffMs / (7 * 86400000)));
      durationWeeks = w;
    }

    return {
      mode: t.repeatMode,
      durationWeeks, // absent si indéfini
      everyWeeks: t.repeatMode === RepeatMode.EVERY_X_WEEKS ? (t.repeatEveryWeeks ?? 2) : undefined,
      days:
        t.repeatMode === RepeatMode.WEEKLY || t.repeatMode === RepeatMode.EVERY_X_WEEKS
          ? ((t.repeatDays ?? ['MON']) as WeekDayKey[])
          : undefined,
    };
  }

  private toFertilizationResponse(lines?: TaskFertilizer[] | null): FertLine[] | null {
    if (!lines?.length) return null;
    return lines.map((l) => ({
      name: l.name,
      qty: Number(l.qty),
      unit: l.unit,
    }));
  }

  private normalizeFertilization(input: any): FertLine[] {
    const arr = Array.isArray(input) ? input : [];
    return arr
      .map((x) => ({
        name: (x?.name ?? '').toString().trim(),
        qty: Number(x?.qty ?? 0),
        unit: x?.unit === 'g' ? FertilizerUnit.G : FertilizerUnit.ML,
      }))
      .filter((x) => x.name.length > 0 && Number.isFinite(x.qty) && x.qty > 0);
  }

  private mapTaskToResponse(t: Task) {
    return {
      id: String(t.id),
      title: t.title,
      description: t.description ?? undefined,
      dueAt: t.dueAt.toISOString(),
      status: t.status,
      type: t.type,
      aquarium: t.aquarium ? { id: t.aquarium.id, name: (t.aquarium as any).name } : undefined,
      repeat: this.toRepeatResponse(t),
      fertilization: t.type === TaskType.FERTILIZATION ? this.toFertilizationResponse(t.fertilizers) : null,
      createdAt: t.createdAt?.toISOString?.() ?? undefined,
      virtual: false,
      parentId: null,
    };
  }

  // =========================
  // Helpers: repeat expansion
  // =========================
  private startEndFromMonth(month: string) {
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    return { start, end };
  }

  private jsDayToKey(d: number): WeekDayKey {
    return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d] as WeekDayKey;
  }

  private addDaysUTC(date: Date, days: number) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }

  private startOfDayUTC(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  }

  private sameTimeAs(base: Date, day: Date) {
    return new Date(
      Date.UTC(
        day.getUTCFullYear(),
        day.getUTCMonth(),
        day.getUTCDate(),
        base.getUTCHours(),
        base.getUTCMinutes(),
        base.getUTCSeconds(),
        base.getUTCMilliseconds(),
      ),
    );
  }

  private expandRepeatsIntoMonth(t: Task, start: Date, end: Date) {
    if (!t.isRepeat || t.repeatMode === RepeatMode.NONE) return [];

    const baseDue = new Date(t.dueAt);
    const cursorStart = this.startOfDayUTC(start);
    const cursorEnd = this.startOfDayUTC(end);

    // repeatEndAt null => indéfini (on génère juste sur le mois demandé)
    const endAt = t.repeatEndAt ? new Date(t.repeatEndAt) : null;

    const occurrences: Array<any> = [];

    for (let day = new Date(cursorStart); day < cursorEnd; day = this.addDaysUTC(day, 1)) {
      // ✅ borne EXCLUSIVE : si dueCandidate >= endAt => stop
      if (endAt) {
        const dueCandidate = this.sameTimeAs(baseDue, day);
        if (dueCandidate.getTime() >= endAt.getTime()) continue;
      }

      const dayKey = this.jsDayToKey(day.getUTCDay());
      let ok = false;

      if (t.repeatMode === RepeatMode.DAILY) ok = true;

      if (t.repeatMode === RepeatMode.EVERY_2_DAYS) {
        const diffDays = Math.floor(
          (this.startOfDayUTC(day).getTime() - this.startOfDayUTC(baseDue).getTime()) / 86400000,
        );
        ok = diffDays >= 0 && diffDays % 2 === 0;
      }

      if (t.repeatMode === RepeatMode.WEEKLY) {
        const days = (t.repeatDays ?? ['MON']) as WeekDayKey[];
        ok = days.includes(dayKey);
      }

      if (t.repeatMode === RepeatMode.EVERY_X_WEEKS) {
        const days = (t.repeatDays ?? ['MON']) as WeekDayKey[];
        if (days.includes(dayKey)) {
          const diffDays = Math.floor(
            (this.startOfDayUTC(day).getTime() - this.startOfDayUTC(baseDue).getTime()) / 86400000,
          );
          if (diffDays >= 0) {
            const diffWeeks = Math.floor(diffDays / 7);
            const every = Number(t.repeatEveryWeeks ?? 2);
            ok = diffWeeks % every === 0;
          }
        }
      }

      if (!ok) continue;

      const dueAt = this.sameTimeAs(baseDue, day).toISOString();

      occurrences.push({
        id: `r:${t.id}:${dueAt}`,
        title: t.title,
        description: t.description ?? undefined,
        dueAt,
        status: t.status,
        type: t.type,
        aquarium: t.aquarium ? { id: t.aquarium.id, name: (t.aquarium as any).name } : undefined,
        repeat: this.toRepeatResponse(t),
        fertilization: t.type === TaskType.FERTILIZATION ? this.toFertilizationResponse(t.fertilizers) : null,
        createdAt: t.createdAt?.toISOString?.() ?? undefined,
        virtual: true,
        parentId: t.id,
      });
    }

    return occurrences;
  }

  // =========================
  // Queries
  // =========================
  async findMine(userId: number, month?: string) {
    const qb = this.repo
      .createQueryBuilder('t')
      .leftJoin('t.user', 'u')
      .leftJoinAndSelect('t.aquarium', 'a')
      .leftJoinAndSelect('t.fertilizers', 'f')
      .where('u.id = :userId', { userId })
      .orderBy('t.dueAt', 'ASC');

    let start: Date | undefined;
    let end: Date | undefined;

    if (month) {
      const r = this.startEndFromMonth(month);
      start = r.start;
      end = r.end;
      qb.andWhere('(t.isRepeat = 1 OR (t.dueAt >= :start AND t.dueAt < :end))', { start, end });
    }

    const tasks = await qb.getMany();

    if (!month || !start || !end) {
      return tasks.map((t) => this.mapTaskToResponse(t));
    }

    const real = tasks.filter((t) => !t.isRepeat);
    const templates = tasks.filter((t) => t.isRepeat);

    const realMapped = real.map((t) => this.mapTaskToResponse(t));
    const virtuals = templates.flatMap((t) => this.expandRepeatsIntoMonth(t, start!, end!));

    return [...realMapped, ...virtuals].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  }

  // =========================
  // Mutations
  // =========================
  async create(userId: number, dto: CreateTaskDto) {
    const aquarium = await this.aqRepo.findOne({
      where: { id: dto.aquariumId, user: { id: userId } },
      relations: { user: true },
      select: { id: true } as any,
    });
    if (!aquarium) throw new NotFoundException('Aquarium introuvable ou non autorisé');

    const repeat = (dto.repeat ?? null) as RepeatPayload;
    const type = dto.type ?? TaskType.OTHER;

    const auto = this.autoTitleForType(type);
    const title = type === TaskType.OTHER ? dto.title : auto ?? dto.title;

    const dueAt = new Date(dto.dueAt);

    const task = this.repo.create({
      title,
      description: dto.description,
      dueAt,
      user: { id: userId } as any,
      aquarium,
      status: TaskStatus.PENDING,
      type,

      isRepeat: !!repeat && repeat.mode !== RepeatMode.NONE,
      repeatMode: repeat?.mode ?? RepeatMode.NONE,
      repeatEveryWeeks: repeat?.mode === RepeatMode.EVERY_X_WEEKS ? Number(repeat.everyWeeks ?? 2) : null,
      repeatDays:
        repeat?.mode === RepeatMode.WEEKLY || repeat?.mode === RepeatMode.EVERY_X_WEEKS
          ? (repeat.days ?? ['MON'])
          : null,

      // ✅ si durationWeeks absent => repeatEndAt = null => indéfini
      repeatEndAt:
        repeat?.mode && repeat.mode !== RepeatMode.NONE
          ? this.computeRepeatEndAt(dueAt, repeat.durationWeeks)
          : null,
    });

    const saved = await this.repo.save(task);
    await this.usersService.touchActivity(userId);

    if (dto.type === TaskType.FERTILIZATION) {
      const lines = this.normalizeFertilization(dto.fertilization);
      if (lines.length) {
        const entities = lines.map((l) =>
          this.fertRepo.create({
            taskId: saved.id,
            name: l.name,
            qty: l.qty,
            unit: l.unit,
          }),
        );
        await this.fertRepo.save(entities);
      }
    }

    const full = await this.repo.findOne({
      where: { id: saved.id },
      relations: { aquarium: true, fertilizers: true, user: true },
    });

    return this.mapTaskToResponse(full!);
  }

  async update(userId: number, rawId: string, dto: UpdateTaskDto) {
    const id = this.parseTaskId(rawId);

    const task = await this.repo.findOne({
      where: { id },
      relations: { user: true, aquarium: true, fertilizers: true },
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

    if (dto.dueAt !== undefined) task.dueAt = new Date(dto.dueAt);
    if (dto.status !== undefined) task.status = dto.status;

    // type + titre auto
    if (dto.type !== undefined) {
      task.type = dto.type;

      const auto = this.autoTitleForType(dto.type);
      if (dto.type !== TaskType.OTHER && auto) {
        task.title = auto;
      }
    }

    // titre manuel seulement si OTHER
    if (dto.title !== undefined) {
      if ((dto.type ?? task.type) === TaskType.OTHER) {
        task.title = dto.title;
      }
    }

    if (dto.description !== undefined) task.description = dto.description;

    if (dto.repeat !== undefined) {
      const repeat = (dto.repeat ?? null) as RepeatPayload;

      task.isRepeat = !!repeat && repeat.mode !== RepeatMode.NONE;
      task.repeatMode = repeat?.mode ?? RepeatMode.NONE;
      task.repeatEveryWeeks = repeat?.mode === RepeatMode.EVERY_X_WEEKS ? Number(repeat.everyWeeks ?? 2) : null;
      task.repeatDays =
        repeat?.mode === RepeatMode.WEEKLY || repeat?.mode === RepeatMode.EVERY_X_WEEKS
          ? (repeat.days ?? ['MON'])
          : null;

      // ✅ si durationWeeks absent => repeatEndAt = null => indéfini
      task.repeatEndAt =
        repeat?.mode && repeat.mode !== RepeatMode.NONE
          ? this.computeRepeatEndAt(task.dueAt, repeat.durationWeeks)
          : null;
    }

    const saved = await this.repo.save(task);
    await this.usersService.touchActivity(userId);

    if (dto.fertilization !== undefined) {
      await this.fertRepo.delete({ taskId: saved.id });

      if ((saved.type ?? TaskType.OTHER) === TaskType.FERTILIZATION) {
        const lines = this.normalizeFertilization(dto.fertilization);
        if (lines.length) {
          const entities = lines.map((l) =>
            this.fertRepo.create({
              taskId: saved.id,
              name: l.name,
              qty: l.qty,
              unit: l.unit,
            }),
          );
          await this.fertRepo.save(entities);
        }
      }
    }

    const full = await this.repo.findOne({
      where: { id: saved.id },
      relations: { aquarium: true, fertilizers: true, user: true },
    });

    return this.mapTaskToResponse(full!);
  }

  async remove(userId: number, rawId: string) {
    const id = this.parseTaskId(rawId);

    const task = await this.repo.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!task || task.user.id !== userId) throw new NotFoundException();

    await this.repo.delete(id);
    await this.usersService.touchActivity(userId);
    return { ok: true };
  }
}
