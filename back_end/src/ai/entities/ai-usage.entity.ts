import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('ai_usage')
export class AiUsage {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  userId!: number;

  @Column({ type: 'int', nullable: true })
  aquariumId!: number | null;

  @Column({ type: 'varchar', length: 50 })
  feature!: string;

  @Column({ type: 'varchar', length: 30 })
  plan!: string;

  @Column({ type: 'varchar', length: 80 })
  model!: string;

  @Column({ type: 'int', default: 0 })
  inputTokens!: number;

  @Column({ type: 'int', default: 0 })
  outputTokens!: number;

  @Column({ type: 'int', default: 0 })
  totalTokens!: number;

  @Column({ type: 'longtext' })
  responseText!: string;

  @CreateDateColumn()
  createdAt!: Date;
}