import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Recommendation } from './recommendation.entity';
import { RecommendationService } from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { TaskModule } from '../tasks/task.module';
import { AquariumTargetsModule } from '../aquarium-targets/aquarium-targets.module';
import { FeatureUsageEvent } from './feature-usage-event.entity';
import { FeatureUsageController } from './feature-usage.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Recommendation, FeatureUsageEvent]), TaskModule, AquariumTargetsModule],
  providers: [RecommendationService],
  controllers: [RecommendationController, FeatureUsageController],
  exports: [RecommendationService],
})
export class RecommendationModule {}
