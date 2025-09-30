import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { User } from './user.entity';
import { UpdateMeDto } from './dto/update-me.dto';
import { Injectable, ConflictException } from '@nestjs/common';  // <-- ajoute ConflictException
import { CreateUserDto } from './dto/create-user.dto';           // <-- importe ton DTO de création


@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  findById(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async updateProfile(userId: number, dto: UpdateMeDto) {
    await this.repo.update({ id: userId }, dto);
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
    /**
   * Récupère un utilisateur par email en incluant le hash du mot de passe
   * (pour AuthService.login / register + login).
   */
  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('u')
      .addSelect('u.password')               // inclure le champ password (généralement exclu)
      .where('u.email = :email', { email })
      .getOne();
  }

  /**
   * Crée un utilisateur avec hash argon2.
   * - lève ConflictException si l'email est déjà pris.
   */
  async create(dto: CreateUserDto): Promise<User> {
    const exists = await this.repo.exist({ where: { email: dto.email } });
    if (exists) {
      throw new ConflictException('Email déjà utilisé');
    }

    const password = await argon2.hash(dto.password);

    const user = this.repo.create({
      email: dto.email,
      fullName: dto.fullName?.trim() ?? '',
      password,
      // role: 'user', // <-- décommente si tu as une colonne role et que tu veux la valoriser ici
    });

    return this.repo.save(user);
  }
  async deleteById(id: number) {
  await this.repo.delete(id);
}


}
