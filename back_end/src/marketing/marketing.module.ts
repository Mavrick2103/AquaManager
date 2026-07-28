import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketingController } from './marketing.controller';
import { MarketingPost } from './marketing-post.entity';
import { MarketingService } from './marketing.service';
import { Article } from '../articles/entities/article.entity';
import { User } from '../users/user.entity';
import { MarketingAgentSettings } from './marketing-agent-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MarketingPost, Article, User, MarketingAgentSettings])],
  controllers: [MarketingController],
  providers: [MarketingService],
})
export class MarketingModule {}
