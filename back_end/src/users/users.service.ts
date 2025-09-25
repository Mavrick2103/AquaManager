import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.repo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email déjà utilisé');

    const passwordHash = await argon2.hash(dto.password);
    const user = this.repo.create({
      fullName: dto.fullName,
      email: dto.email,
      password: passwordHash,
      role: 'USER',
    });
    const saved = await this.repo.save(user);
    delete (saved as any).password;
    return saved;
  }

  async findByEmail(email: string): Promise<User> {
    const user = await this.repo.findOne({
      where: { email },
      select: ['id', 'fullName', 'email', 'role'],
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async findByEmailWithPassword(email: string): Promise<User> {
    const user = await this.repo
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.email = :email', { email })
      .getOne();
    if (!user) throw new NotFoundException('Identifiants invalides');
    return user;
  }

  async findById(id: number): Promise<User | null> {
    return this.repo.findOne({
      where: { id },
      select: ['id', 'fullName', 'email', 'role'],
    });
  }
}
