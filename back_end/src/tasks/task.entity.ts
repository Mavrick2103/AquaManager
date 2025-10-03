import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Index } from 'typeorm';
import { User } from '../users/user.entity';
import { Aquarium } from '../aquariums/aquariums.entity';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  /** Date/heure de la tâche (UTC en DB) */
  @Index()
  @Column({ type: 'datetime' })
  dueAt: Date;

  /** Statut simple pour évoluer plus tard */
  @Column({ type: 'enum', enum: ['PENDING', 'DONE'], default: 'PENDING' })
  status: 'PENDING' | 'DONE';

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, (u) => u.id, { onDelete: 'CASCADE', eager: false })
  user: User;

  @ManyToOne(() => Aquarium, (a) => a.id, { onDelete: 'CASCADE', eager: true })
  aquarium: Aquarium;

  @Column({ type: 'enum', enum: ['WATER_CHANGE','FERTILIZATION','TRIM','WATER_TEST','OTHER'], default: 'OTHER' })
  type: 'WATER_CHANGE' | 'FERTILIZATION' | 'TRIM' | 'WATER_TEST' | 'OTHER';

}
