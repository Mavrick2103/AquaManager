import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlanRequired } from '../auth/decorators/plan.decorator';
import { AquariumTargetsService } from './aquarium-targets.service';
import { UpdateAquariumTargetsDto } from './dto/update-aquarium-targets.dto';

@Controller('aquariums/:aquariumId/targets')
@UseGuards(JwtAuthGuard)
export class AquariumTargetsController {
  constructor(private readonly targetsService: AquariumTargetsService) {}

  @Get()
  async getTargets(@Param('aquariumId', ParseIntPipe) aquariumId: number) {
    // ✅ renvoie la map finale complète (toutes les clés)
    return this.targetsService.resolveTargetMap(aquariumId);
  }

  // Personnalisation payante
  @Put()
  @PlanRequired('PREMIUM')
  async updateTargets(
    @Param('aquariumId', ParseIntPipe) aquariumId: number,
    @Body() dto: UpdateAquariumTargetsDto,
  ) {
    const t = await this.targetsService.updateForAquarium(aquariumId, dto as any);
    // ✅ retourne aussi la map complète
    return this.targetsService.resolveTargetMap(t.aquariumId);
  }
}
