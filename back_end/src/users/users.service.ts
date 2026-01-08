import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';

import { User } from './user.entity';
import { UpdateMeDto } from './dto/update-me.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';



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

    if (Object.keys(patch).length === 0) return user;

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
    if (exists) throw new ConflictException('Email déjà utilisé');

    const password = await argon2.hash(dto.password);

    const fullName =
      dto.fullName?.trim().length
        ? dto.fullName.trim()
        : dto.email.split('@')[0];

    const user = this.repo.create({
      email: dto.email,
      fullName,
      password,
      // emailVerifiedAt null par défaut dans ta DB / entity
    });

    return this.repo.save(user);
  }

  async deleteById(id: number) {
    await this.repo.delete(id);
  }

  async setEmailVerifyToken(userId: number, tokenHash: string, expiresAt: Date) {
    await this.repo.update(
      { id: userId },
      {
        emailVerifyTokenHash: tokenHash,
        emailVerifyExpiresAt: expiresAt,
        emailVerifiedAt: null, // optionnel mais propre
      },
    );
  }

  // ✅ FIX : addSelect sur les champs select:false + update (pas save)
  async verifyEmailByTokenHash(tokenHash: string) {
    const user = await this.repo
      .createQueryBuilder('u')
      .addSelect('u.emailVerifyTokenHash')
      .addSelect('u.emailVerifyExpiresAt')
      .where('u.emailVerifyTokenHash = :tokenHash', { tokenHash })
      .getOne();

    if (!user) return null;

    // si expiré / pas de date → KO
    if (!user.emailVerifyExpiresAt) return null;
    if (user.emailVerifyExpiresAt.getTime() < Date.now()) return null;

    // si déjà vérifié → OK (tu peux choisir de retourner null si tu veux)
    if (user.emailVerifiedAt) return user;

    await this.repo.update(
      { id: user.id },
      {
        emailVerifiedAt: new Date(),
        emailVerifyTokenHash: null,
        emailVerifyExpiresAt: null,
      },
    );

    return this.findById(user.id);
  }

  async setPasswordResetToken(email: string, tokenHash: string, expiresAt: Date) {
    const user = await this.repo.findOne({ where: { email } });
    if (!user) return null;

    await this.repo.update(
      { id: user.id },
      {
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpiresAt: expiresAt,
      },
    );

    return user;
  }

  // ✅ FIX : addSelect sur expires/token + update (pas save)
  async resetPasswordByTokenHash(tokenHash: string, newPassword: string) {
    const user = await this.repo
      .createQueryBuilder('u')
      .addSelect('u.resetPasswordTokenHash')
      .addSelect('u.resetPasswordExpiresAt')
      .addSelect('u.password') // utile si tu veux vérifier un truc, sinon pas obligatoire
      .where('u.resetPasswordTokenHash = :tokenHash', { tokenHash })
      .getOne();

    if (!user) return null;
    if (!user.resetPasswordExpiresAt) return null;
    if (user.resetPasswordExpiresAt.getTime() < Date.now()) return null;

    const hashed = await argon2.hash(newPassword);

    await this.repo.update(
      { id: user.id },
      {
        password: hashed,
        resetPasswordTokenHash: null,
        resetPasswordExpiresAt: null,
      },
    );

    return this.findById(user.id);
  }

    async adminList(search?: string) {
    const qb = this.repo.createQueryBuilder('u');

    // ✅ on ne renvoie PAS password (select:false) + champs sensibles restent hors payload
    qb.select(['u.id', 'u.fullName', 'u.email', 'u.role', 'u.createdAt']);

    if (search?.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(u.email) LIKE :q OR LOWER(u.fullName) LIKE :q)', { q });
    }

    qb.orderBy('u.createdAt', 'DESC');
    return qb.getMany();
  }

  async adminGetOne(id: number) {
    if (!Number.isFinite(id)) throw new BadRequestException('Id invalide');

    const user = await this.repo
      .createQueryBuilder('u')
      .select(['u.id', 'u.fullName', 'u.email', 'u.role', 'u.createdAt'])
      .where('u.id = :id', { id })
      .getOne();

    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async adminUpdate(id: number, dto: AdminUpdateUserDto) {
    if (!Number.isFinite(id)) throw new BadRequestException('Id invalide');

    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const patch: Partial<User> = {};

    if (dto.fullName !== undefined) {
      const name = String(dto.fullName ?? '').trim();
      if (name.length < 2) throw new BadRequestException('Nom invalide');
      patch.fullName = name;
    }

    if (dto.email !== undefined) {
      const email = String(dto.email ?? '').trim().toLowerCase();
      if (!email) throw new BadRequestException('Email invalide');

      if (email !== user.email) {
        const exists = await this.repo.exist({ where: { email } });
        if (exists) throw new ConflictException('Email déjà utilisé');
        patch.email = email;
      }
    }

    if (dto.role !== undefined) {
      patch.role = dto.role;
    }

    if (Object.keys(patch).length === 0) {
      // rien à modifier
      return this.adminGetOne(id);
    }

    await this.repo.update({ id }, patch);
    return this.adminGetOne(id);
  }

  async adminDelete(id: number) {
    if (!Number.isFinite(id)) throw new BadRequestException('Id invalide');

    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    try {
      await this.repo.delete(id);
      return { ok: true };
    } catch (e: any) {
      // ✅ MySQL FK constraint fail (ex: user a des aquariums)
      if (e?.code === 'ER_ROW_IS_REFERENCED_2' || e?.errno === 1451) {
        throw new ConflictException(
          'Impossible de supprimer cet utilisateur : il possède des données liées (ex: aquariums). Supprime ses aquariums avant.',
        );
      }
      throw e;
    }
  }

}
