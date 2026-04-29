import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WaterMeasurementController } from './water-measurement.controller';
import { WaterMeasurementService } from './water-measurement.service';
import { WaterMeasurement } from './water-measurement.entity';

import { Aquarium } from '../aquariums/aquariums.entity';
import { UsersModule } from '../users/users.module';
import { RecommendationModule } from '../recommendation/recommendation.module';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WaterMeasurement, Aquarium]),
    UsersModule,
    RecommendationModule,
    GamificationModule,
  ],
  controllers: [WaterMeasurementController],
  providers: [WaterMeasurementService],
  exports: [WaterMeasurementService],
})
export class WaterMeasurementModule {}