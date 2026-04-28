import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Aquarium } from '../aquariums/aquariums.entity';

export type SubscriptionPlan = 'CLASSIC' | 'PREMIUM' | 'PRO';

export const PLAN_RANK: Record<SubscriptionPlan, number> = {
  CLASSIC: 0,
  PREMIUM: 1,
  PRO: 2,
};

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
  role: 'USER' | 'ADMIN' | 'EDITOR';

  // ===== Subscription (paywall) =====
  @Column({
    type: 'enum',
    enum: ['CLASSIC', 'PREMIUM', 'PRO'],
    default: 'CLASSIC',
  })
  subscriptionPlan: SubscriptionPlan;

  // null = pas d'expiration (ex: bêta / accès à vie)
  @Column({ type: 'timestamp', nullable: true })
  subscriptionEndsAt: Date | null;

  // ✅ utile pour tes metrics + tri par inscription
  @CreateDateColumn()
  createdAt: Date;

  @Index()
  @Column({ type: 'timestamp', nullable: true })
  lastActivityAt: Date | null;

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
