import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';

import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { MailService } from '../mail/mail.service';

type JwtPayload = { sub: number; role: string };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.users.findByEmailWithPassword(email);
    if (!user) throw new UnauthorizedException('Email ou mot de passe invalide');

    // bloque login si email pas vérifié
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Email non vérifié. Vérifie ta boîte mail.');
    }

    const ok = await argon2.verify(user.password, password);
    if (!ok) throw new UnauthorizedException('Email ou mot de passe invalide');

    const payload: JwtPayload = {
      sub: user.id,
      role: (user.role ?? 'USER').toUpperCase(),
    };

    const access = await this.signAccess(payload);
    const refresh = await this.signRefresh(payload);

    return { access, refresh };
  }

  async register(dto: CreateUserDto) {
    const user = await this.users.create(dto);

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.sha256(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h

    await this.users.setEmailVerifyToken(user.id, tokenHash, expiresAt);

    // Si l’email plante, tu peux choisir: soit throw, soit log + continuer.
    // Pour éviter les comptes bloqués sans mail, je préfère FAIL (throw).
    await this.mail.sendVerifyEmail(user.email, user.fullName, token);

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      message: 'Compte créé. Vérifie ton e-mail pour activer ton compte.',
    };
  }

  async verifyEmail(token: string) {
    const tokenHash = this.sha256(token);
    const user = await this.users.verifyEmailByTokenHash(tokenHash);
    if (!user) return { ok: false, message: 'Lien invalide ou expiré' };
    return { ok: true, message: 'Email vérifié' };
  }

  async forgotPassword(email: string) {
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.sha256(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 min

    const user = await this.users.setPasswordResetToken(email, tokenHash, expiresAt);
    if (user) {
      await this.mail.sendResetPassword(user.email, user.fullName, token);
    }

    return { ok: true, message: 'Si un compte existe, un email a été envoyé.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.sha256(token);
    const user = await this.users.resetPasswordByTokenHash(tokenHash, newPassword);
    if (!user) return { ok: false, message: 'Lien invalide ou expiré' };
    return { ok: true, message: 'Mot de passe mis à jour' };
  }

  signAccess(payload: JwtPayload) {
    const expiresIn = this.config.get<string>('JWT_EXPIRES') || '15m';
    return this.jwt.signAsync(payload, { expiresIn });
  }

  signRefresh(payload: JwtPayload) {
    const expiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES') || '15d';
    return this.jwt.signAsync(payload, { expiresIn });
  }

  verifyRefresh(token: string) {
    return this.jwt.verifyAsync<JwtPayload>(token);
  }

  private sha256(input: string) {
    return createHash('sha256').update(input).digest('hex');
  }
}
