import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type MarketingCadence = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

@Entity('marketing_agent_settings')
export class MarketingAgentSettings {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'enum', enum: ['WEEKLY', 'BIWEEKLY', 'MONTHLY'], default: 'WEEKLY' })
  cadence: MarketingCadence;

  @Column({ type: 'tinyint', default: 1 })
  dayOfWeek: number;

  @Column({ type: 'tinyint', default: 9 })
  hour: number;

  @Column({ type: 'tinyint', default: 0 })
  minute: number;

  @Column({ type: 'varchar', length: 60, default: 'Europe/Paris' })
  timezone: string;

  @Column({ type: 'datetime', precision: 6, nullable: true, default: null })
  lastGeneratedAt: Date | null;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
