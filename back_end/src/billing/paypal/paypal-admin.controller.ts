import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { BillingRateLimit } from '../../common/throttling/rate-limit.decorator';
import { PaypalAdminService } from './paypal-admin.service';
export class CheckoutControlDto { @IsBoolean() enabled: boolean; }

@Controller('admin/subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PaypalAdminController {
  constructor(private readonly service: PaypalAdminService) {}
  @Get('checkout-control')
  checkoutControl() { return this.service.checkoutControl(); }
  @Patch('checkout-control') @BillingRateLimit()
  setCheckoutControl(@Body() body: CheckoutControlDto, @Req() req: any) { return this.service.setCheckoutControl(body.enabled, Number(req.user.userId)); }
  @Get()
  list(@Query('search') search = '', @Query('page') page = '1', @Query('environment') environment = 'all', @Query('attention') attention = 'false', @Query('status') status = 'all') {
    return this.service.list(search, Number(page), environment, attention === 'true', status);
  }
  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe()) id: string) { return this.service.detail(id); }
  @Post(':id/refresh') @BillingRateLimit()
  refresh(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: any) { return this.service.refresh(id, Number(req.user.userId)); }
}
