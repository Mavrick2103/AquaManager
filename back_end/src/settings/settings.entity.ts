import { Column, Entity, OneToOne, PrimaryGeneratedColumn, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('settings')
export class Settings {
  @PrimaryGeneratedColumn() id: number;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column({ type: 'enum', enum: ['metric','imperial'], default: 'metric' })
  unit: 'metric'|'imperial';

  @Column({ type: 'enum', enum: ['light','dark','system'], default: 'system' })
  theme: 'light'|'dark'|'system';

  @Column({ type: 'enum', enum: ['fr','en'], default: 'fr' })
  language: 'fr'|'en';

  @Column({ type: 'boolean', default: true })
  notifications: boolean;
}
