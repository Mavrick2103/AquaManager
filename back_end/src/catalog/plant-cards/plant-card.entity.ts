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

/** slug util: "Anubias Nana" => "anubias-nana" */
function slugify(input?: string | null): string | null {
  const n = normalizeText(input);
  if (!n) return null;
  return n
    .replace(/[^a-z0-9 ]/g, '') // enlève tout sauf lettres/chiffres/espaces
    .trim()
    .replace(/\s+/g, '-') // espaces => tirets
    .replace(/-+/g, '-'); // tirets multiples => 1 seul
}

@Entity('plant_cards')
@Index(['commonName'])
@Index(['scientificName'])
@Index('UQ_plant_water_common_norm', ['waterType', 'commonNameNormalized'], { unique: true })
@Index('UQ_plant_water_scient_norm', ['waterType', 'scientificNameNormalized'], { unique: true })

// ✅ slug unique (comme fish)
@Index('UQ_plant_slug_norm', ['slugNormalized'], { unique: true })
export class PlantCard {
  @PrimaryGeneratedColumn()
  id: number;

  // ---------- Identité ----------
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

  // ---------- Slug (SEO) ----------
  // URL: /plantes/:slug
  @Column({ type: 'varchar', length: 180, nullable: true })
  slug: string | null;

  // valeur technique unique
  @Column({ type: 'varchar', length: 180, nullable: true })
  slugNormalized: string | null;

  // ---------- Catégories / placement ----------
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

  // ---------- Paramètres ----------
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

  // ---------- Besoins ----------
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

  // ---------- Notes ----------
  @Column({ type: 'text', nullable: true })
  trimming: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  compatibility: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  imageUrl: string | null;

  // ---------- Modération ----------
  @Column({ type: 'enum', enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'APPROVED' })
  status: ModerationStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  rejectReason: string | null;

  // ---------- Ownership / audit ----------
  @Column({ type: 'int', nullable: true })
  createdBy: number | null;

  @Column({ type: 'int', nullable: true })
  approvedBy: number | null;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updatedAt: Date | null;

  @BeforeInsert()
  @BeforeUpdate()
  private computeNormalized(): void {
    // anti-doublons existants
    this.commonNameNormalized = normalizeText(this.commonName) ?? '';
    this.scientificNameNormalized = normalizeText(this.scientificName);

    // slug auto si absent
    // priorité: scientificName puis commonName
    if (!this.slug || !this.slug.trim()) {
      this.slug = slugify(this.scientificName) ?? slugify(this.commonName);
    }

    // slugNormalized (technique)
    this.slugNormalized = slugify(this.slug);
  }
}
