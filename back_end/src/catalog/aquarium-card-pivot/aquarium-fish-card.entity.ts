import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Aquarium } from '../../aquariums/aquariums.entity';
import { FishCard } from '../fish-cards/fish-card.entity';

@Entity('aquarium_fish_cards')
@Index(['aquariumId', 'fishCardId'], { unique: true })
export class AquariumFishCard {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'int' })
  aquariumId: number;

  @Index()
  @Column({ type: 'int' })
  fishCardId: number;

  @Column({ type: 'int', default: 1 })
  count: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => Aquarium, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'aquariumId' })
  aquarium: Aquarium;

  @ManyToOne(() => FishCard, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'fishCardId' })
  fishCard: FishCard;
}

