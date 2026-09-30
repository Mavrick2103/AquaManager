import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('aquariums')
export class Aquarium {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'int' })  lengthCm: number;
  @Column({ type: 'int' })  widthCm: number;
  @Column({ type: 'int' })  heightCm: number;

  @Column({ type: 'float' })
  volumeL: number;

  @Column({ type: 'enum', enum: ['EAU_DOUCE', 'EAU_DE_MER'] })
  waterType: 'EAU_DOUCE' | 'EAU_DE_MER';

  @Column({ type: 'date' })
  startDate: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true })
  archivedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  archiveExpiresAt: Date | null;

  @ManyToOne(() => User, (user) => user.aquariums, { onDelete: 'CASCADE' })
  user: User;
}
