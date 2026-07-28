import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type MarketingPostStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PUBLISHED';
export type MarketingPostFormat = 'POST' | 'CAROUSEL' | 'REEL' | 'STORY';

@Entity('marketing_post')
export class MarketingPost {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'text' })
  caption: string;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  mediaUrl: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  sourceUrl: string | null;

  @Column({ type: 'enum', enum: ['POST', 'CAROUSEL', 'REEL', 'STORY'], default: 'POST' })
  format: MarketingPostFormat;

  @Index()
  @Column({
    type: 'enum',
    enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PUBLISHED'],
    default: 'DRAFT',
  })
  status: MarketingPostStatus;

  @Index()
  @Column({ type: 'datetime', precision: 6, nullable: true, default: null })
  scheduledAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  rejectionReason: string | null;

  @Column({ type: 'boolean', default: false })
  generatedByAi: boolean;

  @Column({ type: 'varchar', length: 700, nullable: true, default: null })
  aiRationale: string | null;

  @Column({ type: 'int' })
  createdById: number;

  @Column({ type: 'int', nullable: true, default: null })
  reviewedById: number | null;

  @Column({ type: 'datetime', precision: 6, nullable: true, default: null })
  reviewedAt: Date | null;

  @Column({ type: 'varchar', length: 120, nullable: true, default: null })
  instagramMediaId: string | null;

  @Column({ type: 'datetime', precision: 6, nullable: true, default: null })
  publishedAt: Date | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
