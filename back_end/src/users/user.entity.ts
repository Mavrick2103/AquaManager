import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Aquarium } from '../aquariums/aquariums.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 120 })
  fullName: string;

  @Index({ unique: true })
  @Column()
  email: string;

  @Column({ select: false })
  password: string;

  @Column({ default: 'USER' })
  role: 'USER' | 'ADMIN';

  // ✅ utile pour tes metrics + tri par inscription
  @CreateDateColumn()
  createdAt: Date;

  // ✅ Email verification
  @Column({ type: 'timestamp', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ type: 'varchar', length: 128, nullable: true, select: false })
  emailVerifyTokenHash: string | null;

  @Column({ type: 'timestamp', nullable: true, select: false })
  emailVerifyExpiresAt: Date | null;

  // ✅ Password reset
  @Column({ type: 'varchar', length: 128, nullable: true, select: false })
  resetPasswordTokenHash: string | null;

  @Column({ type: 'timestamp', nullable: true, select: false })
  resetPasswordExpiresAt: Date | null;

  @OneToMany(() => Aquarium, (aquarium) => aquarium.user, { cascade: false })
  aquariums: Aquarium[];
}
