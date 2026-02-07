import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Task } from './task.entity';
import { TaskFertilizer } from './task-fertilizer.entity';
import { Aquarium } from '../aquariums/aquariums.entity';

import { TaskService } from './task.service';
import { TaskController } from './task.controller';

import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, TaskFertilizer, Aquarium]),
    UsersModule, // ✅ pour injecter UsersService
  ],
  providers: [TaskService],
  controllers: [TaskController],
  exports: [TaskService], // optionnel (utile si un autre module l'utilise)
})
export class TaskModule {}
