import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type OperationalEventType = 'API_ERROR' | 'STRIPE_FAILURE' | 'EMAIL_FAILURE';

@Entity('operational_events')
@Index(['type', 'createdAt'])
export class OperationalEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 30 })
  type!: OperationalEventType;

  @Column({ type: 'varchar', length: 180 })
  route!: string;

  @Column({ type: 'smallint', unsigned: true, default: 500 })
  statusCode!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
