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
} from '@nestjs/common';
import { FishCardsService } from './fish-card.service';
import { CreateFishCardDto } from './dto/create-fish-card.dto';
import { UpdateFishCardDto } from './dto/update-fish-card.dto';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { promises as fsp } from 'fs';

function getUploadDir(): string {
  return process.env.UPLOAD_DIR?.trim() || join(process.cwd(), 'uploads');
}

function ensureFishUploadDir(): string {
  const dir = join(getUploadDir(), 'fish');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function multerImageOptions() {
  return {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const dir = ensureFishUploadDir();
        cb(null, dir);
      },
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
  try {
    await fsp.unlink(path);
  } catch {
    // ignore
  }
}

@Controller()
@UseGuards(JwtAuthGuard)
export class FishCardsController {
  constructor(private readonly service: FishCardsService) {}

  // =========================
  // PUBLIC (USER) - GET only
  // =========================

  @Get('fish-cards')
  list(@Query('search') search?: string) {
    return this.service.findAll(search, true);
  }

  @Get('fish-cards/:id')
  one(@Param('id') id: string) {
    return this.service.findOne(Number(id));
  }

  // =========================
  // ADMIN - Upload image (optionnel)
  // =========================

  @Post('admin/fish-cards/upload')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file', multerImageOptions()))
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fichier manquant');
    return { url: `/uploads/fish/${file.filename}` };
  }

  // =========================
  // ADMIN - CREATE (JSON ou multipart)
  // =========================

  @Post('admin/fish-cards')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file', multerImageOptions()))
  async create(
    @Body() dto: CreateFishCardDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // ✅ Si une image est jointe au POST multipart, on set l’URL ici
    if (file) {
      dto.imageUrl = `/uploads/fish/${file.filename}`;
    }

    try {
      return await this.service.create(dto);
    } catch (err) {
      // ✅ si conflit -> on supprime le fichier écrit par multer pour éviter un orphelin
      const is409 = err instanceof ConflictException || err?.status === 409;
      if (file && is409) {
        // multer fournit souvent file.path (chemin complet)
        await safeUnlink((file as any).path);
      }
      throw err;
    }
  }

  // =========================
  // ADMIN - CRUD
  // =========================

  @Get('admin/fish-cards')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  listAdmin(@Query('search') search?: string) {
    return this.service.findAll(search, false);
  }

  @Get('admin/fish-cards/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  oneAdmin(@Param('id') id: string) {
    return this.service.findOne(Number(id));
  }

  @Patch('admin/fish-cards/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateFishCardDto) {
    return this.service.update(Number(id), dto);
  }

  @Delete('admin/fish-cards/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.service.remove(Number(id));
  }
}
