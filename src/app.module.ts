/**
 * app.module.ts
 * -----------------
 * Module racine de l’application.
 * - Charge les variables d’environnement (ConfigModule)
 * - Configure la connexion MySQL avec TypeORM
 * - Importe les modules métier (Users, Auth)
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './config/typeorm.config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({ useFactory: typeOrmConfig }),
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
