import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Theme } from './theme.entity';
import { User } from '../../users/user.entity';

export type ArticleStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED';

@Entity('articles')
export class Article {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 180 })
  title: string;

  @Column({ type: 'varchar', length: 220, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 350, nullable: true, default: null })
  excerpt: string | null;

  @Column({ type: 'longtext' })
  content: string;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  coverImageUrl: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED'],
    default: 'DRAFT',
  })
  status: ArticleStatus;

  @Column({ type: 'int', default: 0 })
  viewsCount: number;

  @Column({ type: 'datetime', precision: 6, nullable: true, default: null })
  publishedAt: Date | null;

  @Index()
  @Column({ type: 'int' })
  authorId: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Index()
  @Column({ type: 'int', nullable: true, default: null })
  reviewedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy: User | null;

  @Column({ type: 'datetime', precision: 6, nullable: true, default: null })
  reviewedAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  rejectReason: string | null;

  @Index()
  @Column({ type: 'int' })
  themeId: number;

  @ManyToOne(() => Theme, (t) => t.articles, { nullable: false })
  @JoinColumn({ name: 'themeId' })
  theme: Theme;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
