/**
 * main.ts
 * ----------
 * Point d’entrée de l’application NestJS.
 * - Crée l’application
 * - Active les pipes de validation globaux
 * - Lance le serveur sur le port défini dans .env
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
