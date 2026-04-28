import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Recommendation } from './recommendation.entity';
import { RecommendationService } from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { TaskModule } from '../tasks/task.module';
import { AquariumTargetsModule } from '../aquarium-targets/aquarium-targets.module';

@Module({
  imports: [TypeOrmModule.forFeature([Recommendation]), TaskModule, AquariumTargetsModule],
  providers: [RecommendationService],
  controllers: [RecommendationController],
  exports: [RecommendationService],
})
export class RecommendationModule {}
