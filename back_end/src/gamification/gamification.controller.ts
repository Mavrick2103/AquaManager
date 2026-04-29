import { Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GamificationService } from './gamification.service';

@Controller('gamification')
@UseGuards(JwtAuthGuard)
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Get('summary')
  async summary(@Req() req: any) {
    const userId = this.getUserId(req);
    await this.gamification.onAppOpened(userId);
    return this.gamification.getSummary(userId);
  }

  @Get('aquariums/:aquariumId/score')
  score(@Req() req: any, @Param('aquariumId', ParseIntPipe) aquariumId: number) {
    return this.gamification.getAquariumScore(this.getUserId(req), aquariumId);
  }

  @Post('recompute')
  recompute(@Req() req: any) {
    return this.gamification.recomputeUser(this.getUserId(req));
  }

  private getUserId(req: any): number {
    return Number(req.user?.userId ?? req.user?.id ?? req.user?.sub);
  }
}
