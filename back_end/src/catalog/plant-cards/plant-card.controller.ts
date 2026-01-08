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
      destination: (req, file, cb) => {
        const dir = ensurePlantUploadDir();
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

@Controller()
export class PlantCardsController {
  constructor(private readonly service: PlantCardsService) {}

  // =========================
  // PUBLIC (USER) - GET only
  // =========================
  @Get('plant-cards')
  list(@Query('search') search?: string) {
    return this.service.findAll(search, true);
  }

  @Get('plant-cards/:id')
  one(@Param('id') id: string) {
    return this.service.findOne(Number(id));
  }

  // =========================
  // ADMIN - Upload image
  // =========================
  @Post('admin/plant-cards/upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file', multerImageOptions()))
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fichier manquant');
    return { url: `/uploads/plants/${file.filename}` };
  }

  // =========================
  // ADMIN - CREATE (JSON ou multipart)
  // =========================
  @Post('admin/plant-cards')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file', multerImageOptions()))
  async create(
    @Body() dto: CreatePlantCardDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // multipart: set imageUrl
    if (file) {
      dto.imageUrl = `/uploads/plants/${file.filename}`;
    }

    try {
      return await this.service.create(dto);
    } catch (err) {
      // si on a upload un fichier et que la création échoue (doublon, etc),
      // on le supprime pour éviter de polluer /uploads
      if (file) {
        const filePath = join(getUploadDir(), 'plants', file.filename);
        try { await fs.promises.unlink(filePath); } catch {}
      }
      throw err;
    }
  }

  // =========================
  // ADMIN - CRUD
  // =========================
  @Get('admin/plant-cards')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  listAdmin(@Query('search') search?: string) {
    return this.service.findAll(search, false);
  }

  @Get('admin/plant-cards/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  oneAdmin(@Param('id') id: string) {
    return this.service.findOne(Number(id));
  }

  @Patch('admin/plant-cards/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdatePlantCardDto) {
    return this.service.update(Number(id), dto);
  }

  @Delete('admin/plant-cards/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.service.remove(Number(id));
  }
}
