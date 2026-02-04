import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('article_unique_views')
@Index(['articleId', 'day', 'viewKey'], { unique: true })
export class ArticleUniqueView {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'int' })
  articleId: number;

  @Column({ type: 'date' })
  day: string; // 'YYYY-MM-DD'

  @Column({ type: 'char', length: 36 })
  viewKey: string;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;
}
