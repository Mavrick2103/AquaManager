import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, JoinColumn } from 'typeorm';
import { Task } from './task.entity';

export enum FertilizerUnit {
  ML = 'ml',
  G = 'g',
}

@Entity('task_fertilizers')
export class TaskFertilizer {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  taskId: number;

  @ManyToOne(() => Task, (t) => t.fertilizers, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'taskId' })
  task: Task;

  @Column({ length: 40 })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  qty: number;

  @Column({ type: 'enum', enum: FertilizerUnit, default: FertilizerUnit.ML })
  unit: FertilizerUnit;
}
