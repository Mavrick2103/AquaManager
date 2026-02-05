import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminMetricsService, MetricsRange } from './admin-metrics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminMetricsController {
  constructor(private readonly service: AdminMetricsService) {}

  @Get('metrics')
  @Roles('ADMIN')
  async metrics(@Query('range') range?: string) {
    const allowed: MetricsRange[] = ['1d', '7d', '30d', '365d', 'all'];

    const r: MetricsRange = allowed.includes(range as MetricsRange)
      ? (range as MetricsRange)
      : '1d';

    return this.service.getMetrics(r);
  }
}
