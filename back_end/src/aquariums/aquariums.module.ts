import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Aquarium } from './aquariums.entity';
import { AquariumsService } from './aquariums.service';
import { AquariumsController } from './aquariums.controller';

import { AquariumItemsController } from '../catalog/aquarium-card-pivot/aquarium-items.controller';
import { AquariumFishCard } from '../catalog/aquarium-card-pivot/aquarium-fish-card.entity';
import { AquariumPlantCard } from '../catalog/aquarium-card-pivot/aquarium-plant-card.entity';

import { UsersModule } from '../users/users.module'; // ✅ IMPORTANT

@Module({
  imports: [
    TypeOrmModule.forFeature([Aquarium, AquariumFishCard, AquariumPlantCard]),
    UsersModule, // ✅ pour injecter UsersService
  ],
  providers: [AquariumsService],
  controllers: [AquariumsController, AquariumItemsController],
  exports: [AquariumsService],
})
export class AquariumsModule {}
