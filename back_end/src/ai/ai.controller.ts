import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AnalyzePhotoDto } from './dto/analyze-photo.dto';

import { AiService } from './ai.service';
import { AnalyzeAquariumDto } from './dto/analyze-aquarium.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('aquariums/:id/analyze')
  analyzeAquarium(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AnalyzeAquariumDto,
  ) {
    const userId = Number(req.user.userId);
    const aquariumId = Number(id);

    return this.aiService.analyzeAquarium(userId, aquariumId, dto);
  }

  @Post('aquariums/:id/photo-analysis')
@UseInterceptors(
  FileInterceptor('image', {
    limits: {
      fileSize: 2 * 1024 * 1024, // 2 Mo max
    },
    fileFilter: (req, file, callback) => {
      if (!file.mimetype.startsWith('image/')) {
        return callback(new Error('Le fichier doit être une image'), false);
      }

      callback(null, true);
    },
  }),
)
analyzeAquariumPhoto(
  @Req() req: any,
  @Param('id') id: string,
  @UploadedFile() image: Express.Multer.File,
  @Body() dto: AnalyzePhotoDto,
) {
  const userId = Number(req.user.userId);
  const aquariumId = Number(id);

  return this.aiService.analyzeAquariumPhoto(userId, aquariumId, image, dto);
}
}