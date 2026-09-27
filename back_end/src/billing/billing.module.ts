import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { UsersModule } from '../users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { PaypalSubscription, PaypalPayment } from './paypal/paypal-subscription.entity';
import { PaypalApiService } from './paypal/paypal-api.service';
import { PaypalService } from './paypal/paypal.service';
import { PaypalController } from './paypal/paypal.controller';
import { PaypalAdminAction } from './paypal/paypal-admin-action.entity';
import { PaypalAdminController } from './paypal/paypal-admin.controller';
import { PaypalAdminService } from './paypal/paypal-admin.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [UsersModule, MailModule, TypeOrmModule.forFeature([User, PaypalSubscription, PaypalPayment, PaypalAdminAction])],
  controllers: [BillingController, PaypalController, PaypalAdminController],
  providers: [BillingService, PaypalApiService, PaypalService, PaypalAdminService],
})
export class BillingModule {}
