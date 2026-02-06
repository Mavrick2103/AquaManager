import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ArticlesService } from './articles.service';
import { ArticlesAdminController } from './articles.admin.controller';
import { ArticlesPublicController } from './articles.public.controller';

import { Article } from './entities/article.entity';
import { Theme } from './entities/theme.entity';
import { ArticleViewDaily } from './entities/article-view-daily.entity';
import { ArticleUniqueView } from './entities/article-unique-view.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Article, Theme, ArticleViewDaily, ArticleUniqueView])],
  providers: [ArticlesService],
  controllers: [ArticlesPublicController, ArticlesAdminController],
  exports: [ArticlesService], // ✅ AJOUTE ÇA
})
export class ArticlesModule {}
