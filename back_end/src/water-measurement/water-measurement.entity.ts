import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Aquarium } from '../aquariums/aquariums.entity';

@Entity('water_measurements')
export class WaterMeasurement {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Aquarium, a => a.id, { onDelete: 'CASCADE', eager: false })
  aquarium: Aquarium;

  // Date/heure de prélèvement (local → stockée en datetime)
  @Column({ type: 'datetime' })
  takenAt: Date;

  // Valeurs scientifiques : nullables (tu peux ne pas tout mesurer à chaque fois)
  @Column({ type: 'float', nullable: true }) ph: number | null;
  @Column({ type: 'float', nullable: true }) kh: number | null;
  @Column({ type: 'float', nullable: true }) gh: number | null;
  @Column({ type: 'float', nullable: true }) co2: number | null;
  @Column({ type: 'float', nullable: true }) k: number | null;       // Potassium
  @Column({ type: 'float', nullable: true }) no2: number | null;
  @Column({ type: 'float', nullable: true }) no3: number | null;
  @Column({ type: 'float', nullable: true }) amn: number | null;     // Ammoniaque/NH3–NH4
  @Column({ type: 'float', nullable: true }) fe: number | null;      // Fer
  @Column({ type: 'float', nullable: true }) temp: number | null;    // °C
  @Column({ type: 'float', nullable: true }) po4: number | null;     // Phosphates

  @CreateDateColumn()
  createdAt: Date;
}
