import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminMetricsController } from './admin-metrics.controller';
import { AdminMetricsService } from './admin-metrics.service';

import { User } from '../users/user.entity';
import { Aquarium } from '../aquariums/aquariums.entity';
import { Task } from '../tasks/task.entity';
import { WaterMeasurement } from '../water-measurement/water-measurement.entity';
import { Article } from '../articles/entities/article.entity';
import { FishCard } from '../catalog/fish-cards/fish-card.entity';
import { PlantCard } from '../catalog/plant-cards/plant-card.entity';
import { AiUsage } from '../ai/entities/ai-usage.entity';
import { AquariumFishCard } from '../catalog/aquarium-card-pivot/aquarium-fish-card.entity';
import { AquariumPlantCard } from '../catalog/aquarium-card-pivot/aquarium-plant-card.entity';
import { OperationalEvent } from './entities/operational-event.entity';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { OperationalEventsInterceptor } from './operational-events.interceptor';
import { Settings } from '../settings/settings.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Aquarium,
      Task,
      WaterMeasurement,
      Article,
      FishCard,
      PlantCard,
      AiUsage,
      AquariumFishCard,
      AquariumPlantCard,
      OperationalEvent,
      Settings,
    ]),
  ],
  controllers: [AdminMetricsController],
  providers: [
    AdminMetricsService,
    { provide: APP_INTERCEPTOR, useClass: OperationalEventsInterceptor },
  ],
})
export class AdminModule {}
