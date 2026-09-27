import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../../users/user.entity';

@Entity('paypal_subscriptions')
export class PaypalSubscription {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id: string;
  @Index() @Column() userId: number;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'userId' }) user: User;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 64, nullable: true }) paypalId: string | null;
  @Column({ type: 'varchar', length: 64 }) planId: string;
  @Column({ type: 'varchar', length: 8 }) environment: 'sandbox' | 'live';
  @Column({ type: 'varchar', length: 32, default: 'CREATING' }) status: string;
  @Column({ type: 'text', nullable: true }) approvalUrl: string | null;
  @Column({ type: 'datetime', nullable: true }) paidUntil: Date | null;
  @Column({ type: 'datetime', nullable: true }) syncedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
}

@Entity('paypal_payments')
export class PaypalPayment {
  @PrimaryColumn({ type: 'varchar', length: 64 }) id: string;
  @Index() @Column({ type: 'varchar', length: 36 }) subscriptionKey: string;
  @ManyToOne(() => PaypalSubscription, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscriptionKey' }) subscription: PaypalSubscription;
  @Column({ type: 'datetime', nullable: true }) paidAt: Date | null;
  @Column({ type: 'datetime', nullable: true }) periodEnd: Date | null;
  // Sticky: a delayed COMPLETED event must not restore a refunded payment.
  @Column({ default: false }) reversed: boolean;
  @Column({ type: 'datetime', nullable: true }) confirmationEmailAttemptedAt: Date | null;
  @Column({ type: 'datetime', nullable: true }) confirmationEmailSentAt: Date | null;
}
