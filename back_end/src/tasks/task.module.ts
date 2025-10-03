import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './task.entity';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { Aquarium } from '../aquariums/aquariums.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Task, Aquarium, User])],
  providers: [TaskService],
  controllers: [TaskController],
})
export class TaskModule {}
