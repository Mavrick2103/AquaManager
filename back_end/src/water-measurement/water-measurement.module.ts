import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WaterMeasurement } from './water-measurement.entity';
import { Aquarium } from '../aquariums/aquariums.entity';

import { WaterMeasurementService } from './water-measurement.service';
import { WaterMeasurementController } from './water-measurement.controller';

import { UsersModule } from '../users/users.module'; // ✅ pour injecter UsersService

@Module({
  imports: [
    TypeOrmModule.forFeature([WaterMeasurement, Aquarium]),
    UsersModule, // ✅ IMPORTANT
  ],
  providers: [WaterMeasurementService],
  controllers: [WaterMeasurementController],
  exports: [WaterMeasurementService],
})
export class WaterMeasurementModule {}
