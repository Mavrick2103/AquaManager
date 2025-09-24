/**
 * users.controller.ts
 * ----------------------
 * Contrôleur = expose les routes HTTP liées aux utilisateurs.
 * - POST /users : créer un nouvel utilisateur
 * - GET /users/:id : récupérer un utilisateur par son id
 * Passe les requêtes au service.
 */
import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';
import { User } from './user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto): Promise<User> {
    return this.users.create(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.users.findById(id);
  }
}
