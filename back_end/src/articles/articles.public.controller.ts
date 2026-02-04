import { Controller, Get, Headers, Param, Patch, Query } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { Public } from '../auth/decorators/public.decorator';

@Public()
@Controller('public/articles')
export class ArticlesPublicController {
  constructor(private readonly service: ArticlesService) {}

   @Get('themes')
  themes() {
    return this.service.listThemes(); // ou une méthode dédiée "publicThemes" si tu veux filtrer
  }

  @Get()
  list(@Query('q') q?: string, @Query('theme') theme?: string) {
    return this.service.publicList({ q, theme });
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.service.publicGetBySlug(slug);
  }

  @Patch(':slug/view')
  track(@Param('slug') slug: string, @Headers('x-view-key') viewKey: string) {
    return this.service.trackViewBySlug(slug, viewKey);
  }
}
