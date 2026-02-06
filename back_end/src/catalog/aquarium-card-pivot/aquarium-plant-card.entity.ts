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
import { PlantCard } from '../plant-cards/plant-card.entity';

@Entity('aquarium_plant_cards')
@Index(['aquariumId', 'plantCardId'], { unique: true })
export class AquariumPlantCard {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'int' })
  aquariumId: number;

  @Index()
  @Column({ type: 'int' })
  plantCardId: number;

  @Column({ type: 'int', default: 1 })
  count: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => Aquarium, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'aquariumId' })
  aquarium: Aquarium;

  @ManyToOne(() => PlantCard, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'plantCardId' })
  plantCard: PlantCard;
}
