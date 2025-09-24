/**
 * auth.service.ts
 * -----------------
 * Service = logique métier d’authentification.
 * - Vérifie email + mot de passe (argon2.verify)
 * - Si ok → signe un JWT avec id, email, role
 * - Si non → lève UnauthorizedException
 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(private readonly users: UsersService, private readonly jwt: JwtService) {}

  async login(email: string, password: string) {
    const user = await this.users.findByEmailWithPassword(email);
    const ok = await argon2.verify(user.password, password);
    if (!ok) throw new UnauthorizedException('Identifiants invalides');

    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = await this.jwt.signAsync(payload);
    return { access_token: token };
  }
}
