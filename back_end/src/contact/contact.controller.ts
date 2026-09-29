import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ContactDto } from './contact.dto';
import { MailService } from '../mail/mail.service';
import { Public } from '../auth/decorators/public.decorator';
import { ContactRateLimit } from '../common/throttling/rate-limit.decorator';

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB / fichier
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
]);

@Controller('contact')
export class ContactController {
  constructor(private readonly mail: MailService) {}

  @Public()
  @Post()
  @ContactRateLimit()
  @UseInterceptors(
    FilesInterceptor('attachments', MAX_FILES, {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.has(file.mimetype)) {
          return cb(
            new BadRequestException('Types acceptés : PNG, JPG, WEBP, PDF.'),
            false
          );
        }
        cb(null, true);
      },
      storage: memoryStorage(),
    })
  )
  async send(
    @Body() dto: ContactDto,
    @UploadedFiles() files: Express.Multer.File[]
  ): Promise<{ ok: true }> {
    if ((files ?? []).reduce((total, file) => total + file.size, 0) > MAX_FILE_SIZE) {
      throw new BadRequestException('La taille totale des pièces jointes ne doit pas dépasser 10 Mo.');
    }
    await this.mail.sendContactMessage({
      category: dto.category,
      subject: dto.subject,
      fromEmail: dto.fromEmail,
      message: dto.message,
      attachments: files ?? [],
    });

    return { ok: true };
  }
}
