import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

import * as bodyParser from 'body-parser';

function getUploadDir(): string {
  // En prod (docker): /data/uploads
  // En local: back_end/uploads (car process.cwd() = back_end)
  return process.env.UPLOAD_DIR?.trim() || join(process.cwd(), 'uploads');
}

async function bootstrap() {
  // ✅ IMPORTANT : on coupe le bodyParser interne de Nest
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  const isProd = process.env.NODE_ENV === 'production';

  // ✅ API prefix
  app.setGlobalPrefix('api');

  // ✅ Stripe webhook: RAW body obligatoire
  // (plus tolérant que application/json, Stripe peut envoyer avec charset)
  app.use('/api/billing/webhook', bodyParser.raw({ type: '*/*' }));

  // ✅ Le reste: JSON normal
  app.use(bodyParser.json({ limit: '2mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '2mb' }));

  // ✅ Sert les fichiers uploadés (images) : /uploads/** (PAS sous /api)
  const uploadDir = getUploadDir();
  app.useStaticAssets(uploadDir, {
    prefix: '/uploads',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,

      // ✅ IMPORTANT pour FormData (multipart)
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(cookieParser());

  const allowedOrigins = isProd
    ? ['https://aquamanager.fr', 'https://www.aquamanager.fr']
    : ['http://localhost:4200'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-view-key', 'stripe-signature'],
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(
    `AquaManager API démarrée sur port ${port} (NODE_ENV=${process.env.NODE_ENV || 'development'})`,
  );
}

bootstrap();