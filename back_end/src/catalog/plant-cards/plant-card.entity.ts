import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type WaterType = 'EAU_DOUCE' | 'EAU_DE_MER' | 'SAUMATRE';

export type PlantCategory =
  | 'TIGE'
  | 'ROSETTE'
  | 'RHIZOME'
  | 'MOUSSE'
  | 'GAZONNANTE'
  | 'BULBE'
  | 'FLOTTANTE'
  | 'EPIPHYTE';

export type PlantPlacement =
  | 'AVANT_PLAN'
  | 'MILIEU'
  | 'ARRIERE_PLAN'
  | 'SUR_SUPPORT'
  | 'SURFACE';

export type GrowthRate = 'LENTE' | 'MOYENNE' | 'RAPIDE';
export type Light = 'FAIBLE' | 'MOYEN' | 'FORT';
export type Co2 = 'AUCUN' | 'RECOMMANDE' | 'OBLIGATOIRE';
export type Difficulty = 'FACILE' | 'MOYEN' | 'DIFFICILE';

export type Propagation =
  | 'BOUTURAGE'
  | 'STOLON'
  | 'RHIZOME'
  | 'DIVISION'
  | 'SPORES'
  | 'GRAINES'
  | 'AUCUNE';

export function normalizeText(input?: string | null): string | null {
  const v = (input ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
  return v ? v : null;
}

@Entity('plant_cards')
@Index(['commonName'])
@Index(['scientificName'])
@Index('UQ_plant_water_common_norm', ['waterType', 'commonNameNormalized'], { unique: true })
@Index('UQ_plant_water_scient_norm', ['waterType', 'scientificNameNormalized'], { unique: true })
export class PlantCard {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 120 })
  commonName: string;

  @Column({ type: 'varchar', length: 140 })
  commonNameNormalized: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  scientificName: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  scientificNameNormalized: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  family: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  origin: string | null;

  @Column({ type: 'enum', enum: ['EAU_DOUCE', 'EAU_DE_MER', 'SAUMATRE'], default: 'EAU_DOUCE' })
  waterType: WaterType;

  @Column({
    type: 'enum',
    enum: ['TIGE', 'ROSETTE', 'RHIZOME', 'MOUSSE', 'GAZONNANTE', 'BULBE', 'FLOTTANTE', 'EPIPHYTE'],
    nullable: true,
  })
  category: PlantCategory | null;

  @Column({
    type: 'enum',
    enum: ['AVANT_PLAN', 'MILIEU', 'ARRIERE_PLAN', 'SUR_SUPPORT', 'SURFACE'],
    nullable: true,
  })
  placement: PlantPlacement | null;

  @Column({ type: 'enum', enum: ['LENTE', 'MOYENNE', 'RAPIDE'], nullable: true })
  growthRate: GrowthRate | null;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
  maxHeightCm: number | null;

  @Column({
    type: 'enum',
    enum: ['BOUTURAGE', 'STOLON', 'RHIZOME', 'DIVISION', 'SPORES', 'GRAINES', 'AUCUNE'],
    nullable: true,
  })
  propagation: Propagation | null;

  @Column({ type: 'enum', enum: ['FAIBLE', 'MOYEN', 'FORT'], nullable: true })
  light: Light | null;

  @Column({ type: 'enum', enum: ['AUCUN', 'RECOMMANDE', 'OBLIGATOIRE'], nullable: true })
  co2: Co2 | null;

  @Column({ type: 'enum', enum: ['FACILE', 'MOYEN', 'DIFFICILE'], nullable: true })
  difficulty: Difficulty | null;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  tempMin: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  tempMax: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
  phMin: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
  phMax: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  ghMin: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  ghMax: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  khMin: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  khMax: number | null;

  @Column({ type: 'boolean', nullable: true })
  needsFe: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  needsNo3: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  needsPo4: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  needsK: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  substrateRequired: boolean | null;

  @Column({ type: 'text', nullable: true })
  trimming: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  compatibility: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  imageUrl: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updatedAt: Date | null;

  @BeforeInsert()
  @BeforeUpdate()
  private computeNormalized(): void {
    this.commonNameNormalized = normalizeText(this.commonName) ?? '';
    this.scientificNameNormalized = normalizeText(this.scientificName);
  }
}
