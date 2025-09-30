import { Controller, Get, Param, ParseIntPipe, Post, Body } from '@nestjs/common';
import { WaterMeasurementService } from './water-measurement.service';
import { CreateWaterMeasurementDto } from './dto/create-water-measurement.dto';

@Controller('aquariums/:aquariumId/measurements')
export class WaterMeasurementController {
  constructor(private svc: WaterMeasurementService) {}

  @Get()
  list(@Param('aquariumId', ParseIntPipe) aquariumId: number) {
    return this.svc.listForAquarium(aquariumId);
  }

  @Post()
  create(@Param('aquariumId', ParseIntPipe) aquariumId: number, @Body() dto: CreateWaterMeasurementDto) {
    return this.svc.createForAquarium(aquariumId, dto);
  }
}
