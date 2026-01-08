import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlantCard } from './plant-card.entity';
import { PlantCardsService } from './plant-card.service';
import { PlantCardsController } from './plant-card.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PlantCard])],
  controllers: [PlantCardsController],
  providers: [PlantCardsService],
  exports: [PlantCardsService],
})
export class PlantCardsModule {}
