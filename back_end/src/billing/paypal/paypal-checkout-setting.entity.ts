import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('paypal_checkout_settings')
export class PaypalCheckoutSetting {
  @PrimaryColumn() id: number;
  @Column({ type: 'boolean', default: true }) enabled: boolean;
  @Column({ type: 'int', nullable: true }) updatedBy: number | null;
  @Column({ type: 'datetime', nullable: true }) updatedAt: Date | null;
}
