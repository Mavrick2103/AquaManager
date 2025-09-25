import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Aquarium } from './aquariums.entity';
import { AquariumsService } from './aquariums.service';
import { AquariumsController } from './aquariums.controller';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Aquarium, User])],
  providers: [AquariumsService],
  controllers: [AquariumsController],
  exports: [TypeOrmModule],
})
export class AquariumsModule {}
