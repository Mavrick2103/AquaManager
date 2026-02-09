import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';

export type WaterType = 'EAU_DOUCE' | 'EAU_DE_MER' | 'SAUMATRE';
export type Temperament = 'PACIFIQUE' | 'SEMI_AGRESSIF' | 'AGRESSIF';
export type Activity = 'DIURNE' | 'NOCTURNE' | 'CREPUSCULAIRE';
export type Difficulty = 'FACILE' | 'MOYEN' | 'DIFFICILE';

export type ModerationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export function normalizeText(input?: string | null): string | null {
  const v = (input ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
  return v ? v : null;
}

@Entity('fish_cards')
@Index(['commonName'])
@Index(['scientificName'])
@Index('UQ_fish_water_common_norm', ['waterType', 'commonNameNormalized'], { unique: true })
@Index('UQ_fish_water_scient_norm', ['waterType', 'scientificNameNormalized'], { unique: true })
export class FishCard {
  @PrimaryGeneratedColumn()
  id: number;

  // ---------- Identité ----------
  @Column({ type: 'varchar', length: 120 })
  commonName: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  scientificName: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  family: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  origin: string | null;

  @Column({
    type: 'enum',
    enum: ['EAU_DOUCE', 'EAU_DE_MER', 'SAUMATRE'],
    default: 'EAU_DOUCE',
  })
  waterType: WaterType;

  // ---------- Champs techniques (anti-doublons) ----------
  @Column({ type: 'varchar', length: 160 })
  commonNameNormalized: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  scientificNameNormalized: string | null;

  // ---------- Paramètres d’eau ----------
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

  // ---------- Maintenance ----------
  @Column({ type: 'int', nullable: true })
  minVolumeL: number | null;

  @Column({ type: 'int', nullable: true })
  minGroupSize: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  maxSizeCm: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  lifespanYears: number | null;

  @Column({
    type: 'enum',
    enum: ['DIURNE', 'NOCTURNE', 'CREPUSCULAIRE'],
    nullable: true,
  })
  activity: Activity | null;

  @Column({
    type: 'enum',
    enum: ['PACIFIQUE', 'SEMI_AGRESSIF', 'AGRESSIF'],
    nullable: true,
  })
  temperament: Temperament | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  zone: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  diet: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  compatibility: string | null;

  @Column({ type: 'enum', enum: ['FACILE', 'MOYEN', 'DIFFICILE'], nullable: true })
  difficulty: Difficulty | null;

  // ---------- Reproduction / comportement ----------
  @Column({ type: 'text', nullable: true })
  behavior: string | null;

  @Column({ type: 'text', nullable: true })
  breeding: string | null;

  @Column({ type: 'text', nullable: true })
  breedingTips: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // ---------- Média ----------
  @Column({ type: 'varchar', length: 255, nullable: true })
  imageUrl: string | null;

  // ---------- Publication ----------
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // ---------- Modération ----------
  @Column({
    type: 'enum',
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
  })
  status: ModerationStatus;

  @Column({ type: 'text', nullable: true })
  rejectReason: string | null;

  // ---------- Ownership / review ----------
  @Column({ type: 'int', nullable: true })
  createdById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy?: User | null;

  @Column({ type: 'int', nullable: true })
  updatedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updatedById' })
  updatedBy?: User | null;

  @Column({ type: 'int', nullable: true })
  reviewedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy?: User | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

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
