/**
 * users.service.ts
 * -------------------
 * Service = logique métier des utilisateurs.
 * - create(dto) : vérifie doublon, hash le mot de passe, sauvegarde en DB
 * - findByEmailWithPassword(email) : récupère user avec mot de passe (login)
 * - findById(id) : récupère user par ID
 * Ne contient aucune route HTTP.
 */
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  async create(dto: CreateUserDto): Promise<User> {
    const exists = await this.repo.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email déjà utilisé');
    const user = this.repo.create({
      email: dto.email,
      password: await argon2.hash(dto.password),
    });
    return this.repo.save(user);
  }

  async findByEmailWithPassword(email: string): Promise<User> {
    const user = await this.repo.findOne({
      where: { email },
      select: ['id', 'email', 'password', 'role'],
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async findById(id: number): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }
}
