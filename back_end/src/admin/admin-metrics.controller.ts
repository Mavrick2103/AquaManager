import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminMetricsService } from './admin-metrics.service';

type MetricsRange = '7d' | '30d' | 'all';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminMetricsController {
  constructor(private readonly service: AdminMetricsService) {}

  @Get('metrics')
  getMetrics(@Query('range') range: MetricsRange = '30d') {
    const safe: MetricsRange = (range === '7d' || range === '30d' || range === 'all') ? range : '30d';
    return this.service.getMetrics(safe);
  }
}
