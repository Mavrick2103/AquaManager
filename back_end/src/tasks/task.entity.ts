import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Aquarium } from '../aquariums/aquariums.entity';
import { TaskFertilizer } from './task-fertilizer.entity';

export enum TaskStatus {
  PENDING = 'PENDING',
  DONE = 'DONE',
}

export enum TaskType {
  WATER_CHANGE = 'WATER_CHANGE',
  FERTILIZATION = 'FERTILIZATION',
  TRIM = 'TRIM',
  WATER_TEST = 'WATER_TEST',
  OTHER = 'OTHER',
}

export enum RepeatMode {
  NONE = 'NONE',
  DAILY = 'DAILY',
  EVERY_2_DAYS = 'EVERY_2_DAYS',
  WEEKLY = 'WEEKLY',
  EVERY_X_WEEKS = 'EVERY_X_WEEKS',
}

export type WeekDayKey = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Index()
  @Column({ type: 'datetime' })
  dueAt: Date;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.PENDING })
  status: TaskStatus;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, (u) => u.id, { onDelete: 'CASCADE', eager: false })
  user: User;

  @ManyToOne(() => Aquarium, (a) => a.id, { onDelete: 'CASCADE', eager: true })
  aquarium: Aquarium;

  @Column({ type: 'enum', enum: TaskType, default: TaskType.OTHER })
  type: TaskType;

  // ===== Repeat =====
  @Column({ type: 'boolean', default: false })
  isRepeat: boolean;

  @Column({ type: 'enum', enum: RepeatMode, default: RepeatMode.NONE })
  repeatMode: RepeatMode;

  @Column({ type: 'int', nullable: true })
  repeatEveryWeeks?: number | null;

  @Column({ type: 'json', nullable: true })
  repeatDays?: WeekDayKey[] | null;

  // ✅ NOUVEAU: fin de répétition (UTC)
  @Index()
  @Column({ type: 'datetime', nullable: true })
  repeatEndAt?: Date | null;

  // ===== Fertilizers =====
  @OneToMany(() => TaskFertilizer, (f) => f.task, { cascade: false })
  fertilizers?: TaskFertilizer[];
}
