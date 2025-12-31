import {Controller, Get, Param, ParseIntPipe, Post, Body, Delete, Req, UseGuards} from '@nestjs/common';
import { WaterMeasurementService } from './water-measurement.service';
import { CreateWaterMeasurementDto } from './dto/create-water-measurement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('aquariums/:aquariumId/measurements')
export class WaterMeasurementController {
  constructor(private svc: WaterMeasurementService) {}
// récupère les mesure de l'aquarium x
  @Get()
  list(
    @Req() req: any,
    @Param('aquariumId', ParseIntPipe) aquariumId: number,
  ) {
    return this.svc.listForAquarium(req.user.userId, aquariumId);
  }

  // nouvelle mesure d'eau aquarium x
  @Post()
  create(
    @Req() req: any,
    @Param('aquariumId', ParseIntPipe) aquariumId: number,
    @Body() dto: CreateWaterMeasurementDto,
  ) {
    return this.svc.createForAquarium(req.user.userId, aquariumId, dto);
  }
// supprime mesure x de l'aquarium x
  @Delete(':id')
  remove(
    @Req() req: any,
    @Param('aquariumId', ParseIntPipe) aquariumId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.deleteForAquarium(req.user.userId, aquariumId, id);
  }
}
