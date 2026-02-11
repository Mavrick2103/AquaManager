import { Module } from '@nestjs/common';
import { SeoController } from './seo.controller';

import { ArticlesModule } from '../articles/articles.module';
import { FishCardsModule } from '../catalog/fish-cards/fish-card.module';
import { PlantCardsModule } from '../catalog/plant-cards/plant-card.module';

@Module({
  imports: [ArticlesModule, FishCardsModule, PlantCardsModule],
  controllers: [SeoController],
})
export class SeoModule {}
