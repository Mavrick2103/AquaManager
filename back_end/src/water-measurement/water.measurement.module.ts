import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WaterMeasurement } from './water-measurement.entity';
import { WaterMeasurementsService } from './water-measurement.service';
import { WaterMeasurementsController } from './water-measurement.controller';
import { Aquarium } from '../aquariums/aquariums.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WaterMeasurement, Aquarium])],
  providers: [WaterMeasurementsService],
  controllers: [WaterMeasurementsController],
  exports: [WaterMeasurementsService],
})
export class WaterMeasurementsModule {}