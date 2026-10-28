import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../../users/user.entity';
import type { ActivityKind } from '../progression-policy';

@Entity('gamification_activities')
@Index(['userId', 'kind', 'activityDate'])
export class GamificationActivity {
  @PrimaryColumn() userId: number;
  @PrimaryColumn({ type: 'varchar', length: 120 }) eventKey: string;
  @Column({ type: 'varchar', length: 24 }) kind: ActivityKind;
  @Column({ type: 'date' }) activityDate: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' }) user: User;
}
