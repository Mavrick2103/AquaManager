import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Aquarium } from './aquariums.entity';
import { AquariumsService } from './aquariums.service';
import { AquariumsController } from './aquariums.controller';
import { User } from '../users/user.entity';

import { AquariumItemsController } from '../catalog/aquarium-card-pivot/aquarium-items.controller';
import { AquariumFishCard } from '../catalog/aquarium-card-pivot/aquarium-fish-card.entity';
import { AquariumPlantCard } from '../catalog/aquarium-card-pivot/aquarium-plant-card.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Aquarium,
      User,
      AquariumFishCard,
      AquariumPlantCard,
    ]),
  ],
  providers: [AquariumsService],
  controllers: [
    AquariumsController,
    AquariumItemsController, // ✅ IMPORTANT sinon 404
  ],
  exports: [AquariumsService],
})
export class AquariumsModule {}
