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

export type ArticleStatus = 'DRAFT' | 'PUBLISHED';

@Entity('articles')
export class Article {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 180 })
  title: string;

  @Column({ type: 'varchar', length: 220, unique: true })
  slug: string;

  // ✅ force le type SQL (évite "Object")
  @Column({ type: 'varchar', length: 350, nullable: true, default: null })
  excerpt: string | null;

  @Column({ type: 'longtext' })
  content: string;

  // ✅ force le type SQL
  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  coverImageUrl: string | null;

  @Column({ type: 'enum', enum: ['DRAFT', 'PUBLISHED'], default: 'DRAFT' })
  status: ArticleStatus;

  @Column({ type: 'int', default: 0 })
  viewsCount: number;

  @Column({ type: 'datetime', precision: 6, nullable: true, default: null })
  publishedAt: Date | null;

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
