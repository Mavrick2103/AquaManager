import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Task } from './task.entity';
import { TaskFertilizer } from './task-fertilizer.entity';
import { Aquarium } from '../aquariums/aquariums.entity';

import { TaskService } from './task.service';
import { TaskController } from './task.controller';

import { UsersModule } from '../users/users.module';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, TaskFertilizer, Aquarium]),
    UsersModule,
    forwardRef(() => GamificationModule),
  ],
  providers: [TaskService],
  controllers: [TaskController],
  exports: [TaskService],
})
export class TaskModule {}