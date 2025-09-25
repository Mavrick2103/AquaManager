import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Aquarium } from '../aquariums/aquariums.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 120 })
  fullName: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password: string;

  @Column({ default: 'USER' })
  role: 'USER' | 'ADMIN';

  @OneToMany(() => Aquarium, (aquarium) => aquarium.user, { cascade: false })
  aquariums: Aquarium[];
}
