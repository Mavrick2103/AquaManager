import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminMetricsController } from './admin-metrics.controller';
import { AdminMetricsService } from './admin-metrics.service';

import { User } from '../users/user.entity';
import { Aquarium } from '../aquariums/aquariums.entity';
import { Task } from '../tasks/task.entity';
import { WaterMeasurement } from '../water-measurement/water-measurement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Aquarium, Task, WaterMeasurement])],
  controllers: [AdminMetricsController],
  providers: [AdminMetricsService],
})
export class AdminModule {}
