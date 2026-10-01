import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
@Entity('satisfaction_responses')
@Index(['segment', 'createdAt'])
export class SatisfactionResponse {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column() userId: number;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
  @Column({ length: 10 }) segment: string;
  @Column({ length: 10 }) source: string;
  @Column({ type: 'tinyint' }) rating: number;
  @Column({ type: 'tinyint', nullable: true }) premiumRating: number | null;
  @Column({ type: 'varchar', length: 2000, default: '' }) comment: string;
  @Column({ length: 10, default: 'NEW' }) status: string;
  @CreateDateColumn() createdAt: Date;
}
@Entity('satisfaction_states')
export class SatisfactionState {
  @PrimaryColumn() userId: number;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
  @Column({ default: 0 }) visitDays: number;
  @Column({ type: 'varchar', length: 10, nullable: true }) lastVisitDay:
    | string
    | null;
  @Column({ type: 'datetime', nullable: true }) lastResponseAt: Date | null;
  @Column({ type: 'datetime', nullable: true }) dismissedUntil: Date | null;
}
