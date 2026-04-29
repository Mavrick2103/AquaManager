import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type WeeklyMissionStatus = 'ACTIVE' | 'COMPLETED' | 'EXPIRED';

@Entity('weekly_missions')
@Index(['userId', 'missionKey', 'weekStart'], { unique: true })
export class WeeklyMission {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  userId: number;

  @Column({ type: 'varchar', length: 80 })
  missionKey: string;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'int' })
  target: number;

  @Column({ type: 'int', default: 0 })
  progress: number;

  @Column({ type: 'int', default: 0 })
  xpReward: number;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: WeeklyMissionStatus;

  @Column({ type: 'date' })
  weekStart: string;

  @Column({ type: 'date' })
  weekEnd: string;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
