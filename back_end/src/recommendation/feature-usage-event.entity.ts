import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('feature_usage_events')
@Index(['feature', 'createdAt'])
export class FeatureUsageEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'int', nullable: true })
  userId!: number | null;

  @Column({ type: 'int', nullable: true })
  aquariumId!: number | null;

  @Column({ type: 'varchar', length: 40 })
  feature!: string;

  @Column({ type: 'int', nullable: true })
  resourceId!: number | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  visitorKey!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
