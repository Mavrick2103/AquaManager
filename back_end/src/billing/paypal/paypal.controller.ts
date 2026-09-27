import { Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { BillingRateLimit } from '../../common/throttling/rate-limit.decorator';
import { PaypalService } from './paypal.service';

@Controller('billing/paypal')
export class PaypalController {
  constructor(private readonly paypal: PaypalService) {}
  @Get('status') @BillingRateLimit()
  status(@Req() req: any) { return this.paypal.status(Number(req.user.userId)); }
  @Post('refresh') @BillingRateLimit()
  refresh(@Req() req: any) { return this.paypal.refresh(Number(req.user.userId)); }
  @Post('cancel') @BillingRateLimit()
  cancel(@Req() req: any) { return this.paypal.cancel(Number(req.user.userId)); }
  @Post('webhook') @Public() @HttpCode(200)
  webhook(@Req() req: any) { return this.paypal.webhook(req.headers, req.body); }
}
