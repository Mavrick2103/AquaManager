import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.users.findByEmailWithPassword(email);

    // ✅ Si l'utilisateur n'existe pas
    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe invalide');
    }

    // ✅ Vérifie le hash argon2 (user.password est présent grâce à addSelect)
    const ok = await argon2.verify(user.password, password);
    if (!ok) {
      throw new UnauthorizedException('Email ou mot de passe invalide');
    }

    // ✅ On peut maintenant accéder aux champs sans erreur TS
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role ?? 'user',
    };

    return {
      access_token: await this.jwt.signAsync(payload),
    };
  }

  async register(dto: CreateUserDto) {
    const user = await this.users.create(dto);
    return { id: user.id, fullName: user.fullName, email: user.email };
  }
}
