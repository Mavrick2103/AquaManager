import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { ArticlesService } from './articles.service';
import { CreateThemeDto } from './dto/create-theme.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@Roles('ADMIN')
@Controller('admin/articles')
export class ArticlesAdminController {
  constructor(private readonly service: ArticlesService) {}

  // THEMES
  @Get('themes')
  listThemes() {
    return this.service.listThemes();
  }

  @Post('themes')
  createTheme(@Body() dto: CreateThemeDto) {
    return this.service.createTheme(dto.name);
  }

  // ARTICLES
  @Get()
  list(@Query('q') q?: string, @Query('themeId') themeId?: string, @Query('status') status?: string) {
    return this.service.adminList({
      q,
      themeId: themeId ? Number(themeId) : undefined,
      status,
    });
  }

  @Post()
  create(@Body() dto: CreateArticleDto) {
    return this.service.createArticle(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.adminGetById(Number(id));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateArticleDto) {
    return this.service.updateArticle(Number(id), dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.deleteArticle(Number(id));
  }

  @Get(':id/stats')
  stats(@Param('id') id: string, @Query('days') days?: string) {
    return this.service.adminStats(Number(id), days ? Number(days) : 30);
  }
}
