import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('paypal_admin_actions')
export class PaypalAdminAction {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column({ type: 'varchar', length: 36 }) subscriptionKey: string;
  @Column() actorId: number;
  @Column({ type: 'varchar', length: 16 }) outcome: 'STARTED' | 'SUCCESS' | 'FAILED';
  @CreateDateColumn() createdAt: Date;
}
