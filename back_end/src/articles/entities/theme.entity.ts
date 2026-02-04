import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Article } from './article.entity';

@Entity('themes')
export class Theme {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 80, unique: true })
  name: string;

  @Column({ length: 120, unique: true })
  slug: string;

  @OneToMany(() => Article, (a) => a.theme)
  articles: Article[];

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
