import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';

import { PlantCardsService } from './plant-card.service';
import { CreatePlantCardDto } from './dto/create-plant-card.dto';
import { UpdatePlantCardDto } from './dto/update-plant-card.dto';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { promises as fsp } from 'fs';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Public } from '../../auth/decorators/public.decorator';


function getUploadDir(): string {
  return process.env.UPLOAD_DIR?.trim() || join(process.cwd(), 'uploads');
}

function ensurePlantUploadDir(): string {
  const dir = join(getUploadDir(), 'plants');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function multerImageOptions() {
  return {
    storage: diskStorage({
      destination: (req, file, cb) => cb(null, ensurePlantUploadDir()),
      filename: (req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
        cb(null, `${randomUUID()}${allowed.includes(ext) ? ext : '.jpg'}`);
      },
    }),
    limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
    fileFilter: (req: any, file: any, cb: any) => {
      const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
      cb(ok ? null : new BadRequestException('Type image non autorisé'), ok);
    },
  };
}

async function safeUnlink(path?: string) {
  if (!path) return;
  try { await fsp.unlink(path); } catch {}
}

function mustUserId(value: unknown): number {
  const id = Number(value);
  if (!Number.isFinite(id) || id <= 0) throw new UnauthorizedException('Invalid token payload (missing userId)');
  return id;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class PlantCardsController {
  constructor(private readonly service: PlantCardsService) {}

  // =========================
  // PUBLIC (USER) - APPROVED + ACTIVE ONLY
  // =========================
  @Public()
  @Get('plant-cards')
  listPublic(@Query('search') search?: string) {
    return this.service.findAllPublic(search);
  }

  @Public()
  @Get('plant-cards/:id')
  onePublic(@Param('id') id: string) {
    return this.service.findOnePublic(Number(id));
  }

  // =========================
  // SHARED UPLOAD (ADMIN + EDITOR)
  // =========================
  @Post('species/plant/upload')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'EDITOR')
  @UseInterceptors(FileInterceptor('file', multerImageOptions()))
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fichier manquant');
    return { url: `/uploads/plants/${file.filename}` };
  }

  // =========================
  // EDITOR - ONLY OWN
  // =========================
  @Get('editor/plant-cards')
  @UseGuards(RolesGuard)
  @Roles('EDITOR')
  listEditor(
    @CurrentUser('userId') userIdRaw: unknown,
    @Query('search') search?: string,
  ) {
    const editorId = mustUserId(userIdRaw);
    return this.service.findAllEditor(editorId, search);
  }

  @Post('editor/plant-cards')
  @UseGuards(RolesGuard)
  @Roles('EDITOR')
  @UseInterceptors(FileInterceptor('file', multerImageOptions()))
  async createEditor(
    @CurrentUser('userId') userIdRaw: unknown,
    @Body() dto: CreatePlantCardDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const editorId = mustUserId(userIdRaw);

    if (file) dto.imageUrl = `/uploads/plants/${file.filename}`;

    try {
      return await this.service.createEditor(dto, editorId);
    } catch (err) {
      const is409 = err instanceof ConflictException || (err as any)?.status === 409;
      if (file && is409) await safeUnlink((file as any).path);
      throw err;
    }
  }

  @Patch('editor/plant-cards/:id')
  @UseGuards(RolesGuard)
  @Roles('EDITOR')
  updateEditor(
    @CurrentUser('userId') userIdRaw: unknown,
    @Param('id') id: string,
    @Body() dto: UpdatePlantCardDto,
  ) {
    const editorId = mustUserId(userIdRaw);
    return this.service.updateEditor(Number(id), dto, editorId);
  }

  @Delete('editor/plant-cards/:id')
  @UseGuards(RolesGuard)
  @Roles('EDITOR')
  removeEditor(
    @CurrentUser('userId') userIdRaw: unknown,
    @Param('id') id: string,
  ) {
    const editorId = mustUserId(userIdRaw);
    return this.service.removeEditor(Number(id), editorId);
  }

  // =========================
  // ADMIN - CRUD + MODERATION
  // =========================
  @Get('admin/plant-cards')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  listAdmin(@Query('search') search?: string) {
    return this.service.findAllAdmin(search);
  }

  @Post('admin/plant-cards')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file', multerImageOptions()))
  async createAdmin(
    @CurrentUser('userId') userIdRaw: unknown,
    @Body() dto: CreatePlantCardDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const adminId = mustUserId(userIdRaw);

    if (file) dto.imageUrl = `/uploads/plants/${file.filename}`;

    try {
      return await this.service.createAdmin(dto, adminId);
    } catch (err) {
      const is409 = err instanceof ConflictException || (err as any)?.status === 409;
      if (file && is409) await safeUnlink((file as any).path);
      throw err;
    }
  }

  @Patch('admin/plant-cards/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  updateAdmin(
    @CurrentUser('userId') userIdRaw: unknown,
    @Param('id') id: string,
    @Body() dto: UpdatePlantCardDto,
  ) {
    const adminId = mustUserId(userIdRaw);
    return this.service.updateAdmin(Number(id), dto, adminId);
  }

  @Post('admin/plant-cards/:id/approve')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  approve(@CurrentUser('userId') userIdRaw: unknown, @Param('id') id: string) {
    const adminId = mustUserId(userIdRaw);
    return this.service.approve(Number(id), adminId);
  }

  @Post('admin/plant-cards/:id/reject')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  reject(
    @CurrentUser('userId') userIdRaw: unknown,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    const adminId = mustUserId(userIdRaw);
    return this.service.reject(Number(id), adminId, String(body?.reason ?? ''));
  }

  @Delete('admin/plant-cards/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  removeAdmin(@Param('id') id: string) {
    return this.service.removeAdmin(Number(id));
  }
}
