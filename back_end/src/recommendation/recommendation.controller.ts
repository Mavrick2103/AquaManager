import { Controller, Get, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { PlanRequired } from '../auth/decorators/plan.decorator';

@Controller('recommendations')
@PlanRequired('PREMIUM')
export class RecommendationController {
  constructor(private readonly service: RecommendationService) {}

  @Get('pending')
  async listPending(@Req() req: any, @Query('aquariumId') aquariumId?: string) {
    const userId = Number(req.user.userId);
    const aq = aquariumId ? Number(aquariumId) : undefined;
    return this.service.listPending(userId, aq);
  }

  @Post(':id/accept')
  async accept(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const userId = Number(req.user.userId);
    return this.service.accept(userId, id);
  }

  @Post(':id/reject')
  async reject(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const userId = Number(req.user.userId);
    return this.service.reject(userId, id);
  }
}
