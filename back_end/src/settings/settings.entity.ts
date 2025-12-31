import { Column, Entity, OneToOne, PrimaryGeneratedColumn, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('settings')
export class Settings {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  // ==== Apparence ====
  @Column({ type: 'enum', enum: ['system','light','dark'], default: 'system' })
  theme: 'system'|'light'|'dark';

  @Column({ type: 'enum', enum: ['cards','table'], default: 'cards' })
  defaultView: 'cards'|'table';

  // ==== Unités ====
  @Column({ type: 'enum', enum: ['C','F'], default: 'C' })
  temperatureUnit: 'C'|'F';

  @Column({ type: 'enum', enum: ['L','GAL'], default: 'L' })
  volumeUnit: 'L'|'GAL';

  // ==== Notifications ====
  @Column({ type: 'boolean', default: true })
  emailNotifications: boolean;

  @Column({ type: 'boolean', default: false })
  pushNotifications: boolean;

  // ==== Alertes & Seuils ====
  @Column({ type: 'boolean', default: true })
  alertsEnabled: boolean;

  @Column({ type: 'float', default: 6.0 })
  phMin: number;

  @Column({ type: 'float', default: 7.5 })
  phMax: number;

  @Column({ type: 'float', default: 22 })
  tempMin: number;

  @Column({ type: 'float', default: 26 })
  tempMax: number;
}

// En cours de developpement
