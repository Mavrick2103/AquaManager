import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WaterMeasurementsService } from './water-measurement.service';
import { CreateWaterMeasurementDto } from './dto/create-water-measurement.dto';

@UseGuards(JwtAuthGuard)
@Controller('aquariums/:aquariumId/measurements')
export class WaterMeasurementsController {
  constructor(private readonly service: WaterMeasurementsService) {}

  @Get()
  list(
    @Request() req,
    @Param('aquariumId', ParseIntPipe) aquariumId: number,
    @Query('limit') limit?: string,
  ) {
    const l = limit ? Math.min(500, Math.max(1, Number(limit))) : 200;
    return this.service.list(req.user.userId, aquariumId, l);
  }

  @Post()
  create(
    @Request() req,
    @Param('aquariumId', ParseIntPipe) aquariumId: number,
    @Body() dto: CreateWaterMeasurementDto,
  ) {
    return this.service.create(req.user.userId, aquariumId, dto);
  }
}
