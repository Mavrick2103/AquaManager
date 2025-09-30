import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WaterMeasurement } from './water-measurement.entity';
import { Aquarium } from '../aquariums/aquariums.entity';
import { WaterMeasurementService } from './water-measurement.service';
import { WaterMeasurementController } from './water-measurement.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WaterMeasurement, Aquarium])],
  providers: [WaterMeasurementService],
  controllers: [WaterMeasurementController],
  exports: [WaterMeasurementService],
})
export class WaterMeasurementModule {}
