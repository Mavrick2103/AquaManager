import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Aquarium } from '../aquariums/aquariums.entity';
import { AquariumTargets } from './aquarium-targets.entity';
import { AquariumTargetsController } from './aquarium-targets.controller';
import { AquariumTargetsService } from './aquarium-targets.service';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [TypeOrmModule.forFeature([AquariumTargets, Aquarium, GamificationModule])],
  controllers: [AquariumTargetsController],
  providers: [AquariumTargetsService],
  exports: [AquariumTargetsService],
})
export class AquariumTargetsModule {}
