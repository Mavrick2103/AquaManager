import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Aquarium } from '../aquariums/aquariums.entity';
import { WaterMeasurement } from '../water-measurement/water-measurement.entity';
import { AquariumTargetsModule } from '../aquarium-targets/aquarium-targets.module';
import { UsersModule } from '../users/users.module';

import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';
import { AquariumScoreService } from './score/aquarium-score.service';
import { WeeklyMissionService } from './missions/weekly-mission.service';
import { AchievementService } from './achievements/achievement.service';

import { AquariumHealthScore } from './entities/aquarium-health-score.entity';
import { GamificationProfile } from './entities/gamification-profile.entity';
import { UserAchievement } from './entities/user-achievement.entity';
import { WeeklyMission } from './entities/weekly-mission.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Aquarium,
      WaterMeasurement,
      AquariumHealthScore,
      GamificationProfile,
      UserAchievement,
      WeeklyMission,
    ]),
    UsersModule,
    forwardRef(() => AquariumTargetsModule),
  ],
  controllers: [GamificationController],
  providers: [
    GamificationService,
    AquariumScoreService,
    WeeklyMissionService,
    AchievementService,
  ],
  exports: [GamificationService, AquariumScoreService],
})
export class GamificationModule {}
