import { Controller, Post, Get, Req, Headers, UseGuards, HttpCode, Query } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import type { Request } from 'express';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  // ✅ PROTÉGÉ (normal)
  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  checkout(@Req() req: any) {
    const userId = Number(req.user?.userId ?? req.user?.id ?? req.user?.sub);
    return this.billing.createCheckoutSession(userId);
  }

  // ✅ PROTÉGÉ : ouvre le portail Stripe (résiliation / CB / factures)
  @UseGuards(JwtAuthGuard)
  @Get('portal')
  portal(@Req() req: any) {
    const userId = Number(req.user?.userId ?? req.user?.id ?? req.user?.sub);
    return this.billing.createCustomerPortalSession(userId);
  }

  // ✅ OPTIONNEL : résiliation depuis ton app (sans portail)
  // /api/billing/cancel?atPeriodEnd=true|false
  @UseGuards(JwtAuthGuard)
  @Post('cancel')
  cancel(@Req() req: any, @Query('atPeriodEnd') atPeriodEnd?: string) {
    const userId = Number(req.user?.userId ?? req.user?.id ?? req.user?.sub);
    const cancelAtPeriodEnd = atPeriodEnd !== 'false'; // default true
    return this.billing.cancelMySubscription(userId, cancelAtPeriodEnd);
  }

  // ✅ PUBLIC (Stripe webhook)
  @Public()
  @Post('webhook')
  @HttpCode(200)
  webhook(@Req() req: Request, @Headers('stripe-signature') sig: string) {
    return this.billing.handleWebhook(req.body as any, sig);
  }
}