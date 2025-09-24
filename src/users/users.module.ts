/**
 * users.module.ts
 * -----------------
 * Module Users = assemble l’entité, le service et le contrôleur.
 * - Déclare User comme entité TypeORM
 * - Fournit UsersService
 * - Fournit UsersController
 * - Exporte UsersService pour l’utiliser ailleurs (ex: Auth)
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
