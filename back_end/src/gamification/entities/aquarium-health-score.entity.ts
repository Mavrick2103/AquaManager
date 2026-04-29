import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AquariumHealthStatus = 'STABLE' | 'WATCH' | 'CRITICAL' | 'UNKNOWN';
export type AquariumScoreMode = 'TRACKING' | 'HEALTH';

export type AquariumHealthDetails = {
  mode: AquariumScoreMode;

  // Commun
  bonuses?: string[];
  penalties?: string[];
  lastMeasurementAt?: string | null;

  // Score suivi gratuit
  tracking?: {
    hasRecentMeasurement: boolean;
    hasHistory: boolean;
    aquariumCompleted: boolean;
  };

  // Score santé premium
  measuredParams?: number;
  inRangeParams?: number;
  outOfRangeParams?: Array<{
    key: string;
    value: number;
    min: number | null;
    max: number | null;
  }>;
  criticalParams?: string[];
};

@Entity('aquarium_health_scores')
@Index(['userId', 'aquariumId'], { unique: true })
export class AquariumHealthScore {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  userId: number;

  @Index()
  @Column()
  aquariumId: number;

  @Column({ type: 'int', default: 0 })
  score: number;

  @Column({ type: 'varchar', length: 20, default: 'UNKNOWN' })
  status: AquariumHealthStatus;

  /**
   * TRACKING = score gratuit basé sur régularité / suivi.
   * HEALTH = score Premium basé sur objectifs + paramètres.
   */
  @Column({ type: 'varchar', length: 20, default: 'TRACKING' })
  mode: AquariumScoreMode;

  @Column({ type: 'simple-json', nullable: true })
  detailsJson: AquariumHealthDetails | null;

  @Column({ type: 'timestamp', nullable: true })
  computedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
