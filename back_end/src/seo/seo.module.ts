import { Module } from '@nestjs/common';
import { SeoController } from './seo.controller';
import { ArticlesModule } from '../articles/articles.module';

@Module({
  imports: [ArticlesModule],
  controllers: [SeoController],
})
export class SeoModule {}
