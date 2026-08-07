import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AdminUsersController } from './admin-users.controller';

// ⚠️ Ajuste les chemins si besoin
import { Aquarium } from '../aquariums/aquariums.entity';
import { WaterMeasurement } from '../water-measurement/water-measurement.entity';
import { Task } from '../tasks/task.entity';
import { AquariumFishCard } from '../catalog/aquarium-card-pivot/aquarium-fish-card.entity';
import { AquariumPlantCard } from '../catalog/aquarium-card-pivot/aquarium-plant-card.entity';
import { GamificationProfile } from '../gamification/entities/gamification-profile.entity';
import { Article } from '../articles/entities/article.entity';
import { FishCard } from '../catalog/fish-cards/fish-card.entity';
import { PlantCard } from '../catalog/plant-cards/plant-card.entity';
import { Settings } from '../settings/settings.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Aquarium,
      WaterMeasurement,
      Task,
      AquariumFishCard,
      AquariumPlantCard,
      GamificationProfile,
      Article,
      FishCard,
      PlantCard,
      Settings,
    ]),
  ],
  providers: [UsersService],
  controllers: [UsersController, AdminUsersController],
  exports: [TypeOrmModule, UsersService],
})
export class UsersModule {}
