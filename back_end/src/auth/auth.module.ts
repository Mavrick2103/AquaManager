// src/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    // IMPORTANT: sans forRoot(), ConfigService peut ne pas charger ton .env => JWT_SECRET undefined => 401 partout
    ConfigModule.forRoot({
      isGlobal: true,
      // envFilePath: '.env', // optionnel si ton .env est à la racine
    }),

    UsersModule,
    MailModule,

    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET'),
        // optionnel: valeur par défaut si tu fais parfois jwt.sign() sans expiresIn
        signOptions: { expiresIn: cfg.get<string>('JWT_EXPIRES') || '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,

    // Guards globaux (si tu les gardes ici, tu n'as plus besoin de @UseGuards partout)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
