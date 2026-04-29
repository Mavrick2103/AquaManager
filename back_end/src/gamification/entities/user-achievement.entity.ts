import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('user_achievements')
@Index(['userId', 'achievementKey'], { unique: true })
export class UserAchievement {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  userId: number;

  @Column({ type: 'varchar', length: 80 })
  achievementKey: string;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'timestamp' })
  unlockedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
