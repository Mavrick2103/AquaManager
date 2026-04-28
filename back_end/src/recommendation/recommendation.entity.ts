import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum RecommendationSeverity {
  INFO = 'INFO',
  WARN = 'WARN',
  URGENT = 'URGENT',
}

export enum RecommendationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export type RecommendationActionType = 'CREATE_TASK';

@Entity('recommendations')
export class Recommendation {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  userId: number;

  @Index()
  @Column()
  aquariumId: number;

  @Index()
  @Column({ type: 'int', nullable: true })
  measurementId: number | null;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  ruleKey: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'enum', enum: RecommendationSeverity, default: RecommendationSeverity.INFO })
  severity: RecommendationSeverity;

  @Index()
  @Column({ type: 'enum', enum: RecommendationStatus, default: RecommendationStatus.PENDING })
  status: RecommendationStatus;

  @Column({ type: 'enum', enum: ['CREATE_TASK'], default: 'CREATE_TASK' })
  actionType: RecommendationActionType;

  // Contient ce qui sera transformé en Task si le user accepte
  @Column({ type: 'json', nullable: true })
  actionPayload: any | null;

  @Column({ type: 'datetime', nullable: true })
  decidedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
