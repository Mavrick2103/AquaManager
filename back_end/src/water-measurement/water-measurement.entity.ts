import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn } from 'typeorm';
import { Aquarium } from '../aquariums/aquariums.entity';

@Entity('water_measurements')
export class WaterMeasurement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  aquariumId: number;

  @ManyToOne(() => Aquarium, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'aquariumId' })
  aquarium: Aquarium;

  @Column({ type: 'timestamp' })
  measuredAt: Date;

  // communs
  @Column({ type: 'float', nullable: true }) ph: number | null;
  @Column({ type: 'float', nullable: true }) temp: number | null;

  // eau douce
  @Column({ type: 'float', nullable: true }) kh: number | null;
  @Column({ type: 'float', nullable: true }) gh: number | null;
  @Column({ type: 'float', nullable: true }) no2: number | null;
  @Column({ type: 'float', nullable: true }) no3: number | null;
  @Column({ type: 'float', nullable: true }) fe: number | null;
  @Column({ type: 'float', nullable: true }) k: number | null;
  @Column({ type: 'float', nullable: true }) sio2: number | null;
  @Column({ type: 'float', nullable: true }) nh3: number | null;

  // eau de mer
  @Column({ type: 'float', nullable: true }) dkh: number | null;
  @Column({ type: 'float', nullable: true }) salinity: number | null;
  @Column({ type: 'float', nullable: true }) ca: number | null;
  @Column({ type: 'float', nullable: true }) mg: number | null;
  @Column({ type: 'float', nullable: true }) po4: number | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  comment: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
