import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';

import { User } from './user.entity';
import { UpdateMeDto } from './dto/update-me.dto';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  findById(id: number) {
    return this.repo.findOne({ where: { id } });
  }


  async updateProfile(userId: number, dto: UpdateMeDto) {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const patch: Partial<User> = {};

    if (dto.fullName !== undefined) {
      const name = dto.fullName.trim();
      if (name.length > 0) patch.fullName = name;
    }

    if (dto.email !== undefined && dto.email !== user.email) {
      const exists = await this.repo.exist({ where: { email: dto.email } });
      if (exists) throw new ConflictException('Email déjà utilisé');
      patch.email = dto.email;
    }

    if (Object.keys(patch).length === 0) {
      return user;
    }

    await this.repo.update({ id: userId }, patch);
    return this.findById(userId);
  }


  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await this.repo
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.id = :id', { id: userId })
      .getOne();

    if (!user) return false;

    const ok = await argon2.verify(user.password, currentPassword);
    if (!ok) return false;

    const passwordHash = await argon2.hash(newPassword);
    await this.repo.update({ id: userId }, { password: passwordHash });
    return true;
  }


  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.email = :email', { email })
      .getOne();
  }

  async create(dto: CreateUserDto): Promise<User> {
    const exists = await this.repo.exist({ where: { email: dto.email } });
    if (exists) {
      throw new ConflictException('Email déjà utilisé');
    }

    const password = await argon2.hash(dto.password);

    const fullName =
      dto.fullName?.trim().length
        ? dto.fullName.trim()
        : dto.email.split('@')[0];

    const user = this.repo.create({
      email: dto.email,
      fullName,
      password,
    });

    return this.repo.save(user);
  }

  async deleteById(id: number) {
    await this.repo.delete(id);
  }
}
