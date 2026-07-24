import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminMetricsService } from './admin-metrics.service';
import type { MetricsRange } from './admin-metrics.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminMetricsController {
  constructor(private readonly service: AdminMetricsService) {}

  private parseRange(range?: string): MetricsRange {
    const allowed: MetricsRange[] = ['1d', '7d', '30d', '365d', 'all'];

    return allowed.includes(range as MetricsRange)
      ? (range as MetricsRange)
      : '1d';
  }

  @Get('metrics')
  async metrics(@Query('range') range?: string) {
    return this.service.getMetrics(this.parseRange(range));
  }

  @Get('metrics/series/new-users')
  async newUsersSeries(@Query('range') range?: string) {
    return this.service.getNewUsersSeries(this.parseRange(range));
  }

  @Get('metrics/series/active-users')
  async activeUsersSeries(@Query('range') range?: string) {
    return this.service.getActiveUsersSeries(this.parseRange(range));
  }

  @Get('metrics/series/subscriptions')
  async subscriptionsSeries(@Query('range') range?: string) {
    return this.service.getSubscriptionsSeries(this.parseRange(range));
  }
}