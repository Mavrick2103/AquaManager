import { Module } from '@nestjs/common';
import { SeoController } from './seo.controller';

import { ArticlesModule } from '../articles/articles.module';
import { FishCardsModule } from '../catalog/fish-cards/fish-card.module';

@Module({
  imports: [ArticlesModule, FishCardsModule],
  controllers: [SeoController],
})
export class SeoModule {}
