import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ContactDto } from './contact.dto';
import { MailService } from '../mail/mail.service';
import { Public } from '../auth/decorators/public.decorator';

const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB / fichier
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
      storage: diskStorage({
        destination: '/tmp/contact',
        filename: (_req, file, cb) => {
          const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
          cb(null, `${Date.now()}_${Math.random().toString(16).slice(2)}${extname(safe)}`);
        },
      }),
    })
  )
  async send(
    @Body() dto: ContactDto,
    @UploadedFiles() files: Express.Multer.File[]
  ): Promise<{ ok: true }> {
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
