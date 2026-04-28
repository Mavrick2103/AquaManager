import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Aquarium } from '../aquariums/aquariums.entity';

export type TargetRange = { min?: number | null; max?: number | null };
export type TargetMap = Record<string, TargetRange>;

export type AquariumTargetProfileKey =
  | 'BEGINNER_FRESHWATER'
  | 'BEGINNER_SALTWATER'
  | 'CUSTOM';

@Entity('aquarium_targets')
export class AquariumTargets {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  aquariumId: number;

  @OneToOne(() => Aquarium, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'aquariumId' })
  aquarium: Aquarium;

  @Column({ type: 'varchar', length: 64, default: 'BEGINNER_FRESHWATER' })
  profileKey: AquariumTargetProfileKey;

  // Plages attendues par paramètre (NO3, KH, pH, etc.)
  @Column({ type: 'json', nullable: true })
  targets: TargetMap | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
