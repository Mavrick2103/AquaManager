import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { ArticlesService } from './articles.service';
import { CreateThemeDto } from './dto/create-theme.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

type AppRole = 'USER' | 'EDITOR' | 'ADMIN' | 'SUPERADMIN';
type AuthUser = { userId: number; role?: AppRole | string };
type AuthRequest = Request & { user: AuthUser };

@Controller('admin/articles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ArticlesAdminController {
  constructor(private readonly service: ArticlesService) {}

  /* ================= THEMES (ADMIN ONLY) ================= */
  @Roles('ADMIN', 'EDITOR')
@Get('themes')
listThemes() {
  return this.service.listThemes();
}

@Roles('ADMIN')
@Post('themes')
createTheme(@Body() dto: CreateThemeDto) {
  return this.service.createTheme(dto.name);
}


  /* ================= ARTICLES (ADMIN + EDITOR) ================= */
  @Roles('ADMIN', 'EDITOR')
  @Get()
  list(
    @Req() req: AuthRequest,
    @Query('q') q?: string,
    @Query('themeId') themeId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.adminList(
      {
        q,
        themeId: themeId ? Number(themeId) : undefined,
        status,
      },
      req.user,
    );
  }

  @Roles('ADMIN', 'EDITOR')
  @Post()
  create(@Req() req: AuthRequest, @Body() dto: CreateArticleDto) {
    return this.service.createArticle(dto, req.user);
  }

  @Roles('ADMIN', 'EDITOR')
  @Get(':id')
  get(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.adminGetById(Number(id), req.user);
  }

  @Roles('ADMIN', 'EDITOR')
  @Patch(':id')
  update(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: UpdateArticleDto) {
    return this.service.updateArticle(Number(id), dto, req.user);
  }

  // ✅ soumettre à validation
  @Roles('ADMIN', 'EDITOR')
  @Post(':id/submit')
  submit(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.submitForReview(Number(id), req.user);
  }

  // ✅ validation admin
  @Roles('ADMIN')
  @Post(':id/approve')
  approve(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.approveArticle(Number(id), req.user);
  }

  @Roles('ADMIN')
  @Post(':id/reject')
  reject(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.service.rejectArticle(Number(id), body?.reason ?? '', req.user);
  }

  /* ================= DELETE (ADMIN ONLY) ================= */
  @Roles('ADMIN')
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.deleteArticle(Number(id));
  }

  @Roles('ADMIN', 'EDITOR')
  @Get(':id/stats')
  stats(@Req() req: AuthRequest, @Param('id') id: string, @Query('days') days?: string) {
    return this.service.adminStats(Number(id), req.user, days ? Number(days) : 30);
  }
}
