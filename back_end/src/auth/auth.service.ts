import { AuthSessionService, SessionPayload } from './auth-session.service';
import { User } from '../users/user.entity';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash, randomUUID } from 'crypto';

import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { MailService } from '../mail/mail.service';


@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly sessions: AuthSessionService,
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

    return this.issueTokens(user);
  }

  async register(dto: CreateUserDto) {
    const user = await this.users.create(dto);

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.sha256(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h

    await this.users.setEmailVerifyToken(user.id, tokenHash, expiresAt);

    // A failed delivery can be retried through resend-verification.
    try {
      await this.mail.sendVerifyEmail(user.email, user.fullName, token);
    } catch {
      this.logger.warn('Envoi de vérification échoué ; le compte peut demander un nouveau lien.');
    }

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

  if (!user) {
    return {
      ok: false,
      message: 'Ce lien est invalide, expiré ou déjà utilisé.',
      access: null,
      refresh: null,
    };
  }

  const { access, refresh } = await this.issueTokens(user);

  return {
    ok: true,
    message: 'Email vérifié. Connexion en cours…',
    access,
    refresh,
  };
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

  async resendVerification(email: string) {
    const user = await this.users.findByEmailWithPassword(email);
    if (user && !user.emailVerifiedAt) {
      const token = randomBytes(32).toString('hex');
      const updated = await this.users.setEmailVerifyToken(user.id, this.sha256(token), new Date(Date.now() + 86400000));
      try { if (updated) await this.mail.sendVerifyEmail(user.email, user.fullName, token); }
      catch { this.logger.warn('Renvoi de vérification échoué.'); }
    }
    return { ok: true, message: 'Si un compte attend une vérification, un nouveau lien a été envoyé.' };
  }

  private async issueTokens(user: User) {
    const payload: SessionPayload = { sub: user.id, role: user.role.toUpperCase(), sid: randomUUID(), version: user.authVersion ?? 0 };
    const access = await this.signAccess(payload);
    const refresh = await this.signRefresh(payload);
    await this.sessions.create(payload, refresh, this.refreshExpiry(refresh));
    return { access, refresh };
  }

  signAccess(payload: SessionPayload) {
    const expiresIn = this.config.get<string>('JWT_EXPIRES') || '15m';
    return this.jwt.signAsync({ ...payload, kind: 'access' }, { expiresIn });
  }

  signRefresh(payload: SessionPayload) {
    const expiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES') || '15d';
    return this.jwt.signAsync({ ...payload, kind: 'refresh', jti: randomUUID() }, { expiresIn });
  }

  async verifyRefresh(token: string) {
    const payload = await this.jwt.verifyAsync<SessionPayload>(token);
    if (payload.kind !== 'refresh') throw new UnauthorizedException('Jeton de renouvellement requis');
    return payload;
  }

  async refreshTokens(token: string) {
    const payload = await this.verifyRefresh(token);
    const user = await this.sessions.validate(payload);
    const next: SessionPayload = { sub: user.id, role: user.role.toUpperCase(), sid: payload.sid, version: user.authVersion };
    const access = await this.signAccess(next);
    const refresh = await this.signRefresh(next);
    await this.sessions.rotate(next, token, refresh, this.refreshExpiry(refresh));
    return { access, refresh };
  }

  async logout(token?: string) {
    if (!token) return;
    let payload: SessionPayload;
    try { payload = await this.verifyRefresh(token); } catch { return; }
    await this.sessions.revoke(payload);
  }

  private refreshExpiry(token: string): Date {
    const decoded = this.jwt.decode<{ exp: number }>(token);
    if (!Number.isFinite(decoded?.exp)) throw new Error('Missing refresh expiration');
    return new Date(decoded.exp * 1000);
  }

  private sha256(input: string) {
    return createHash('sha256').update(input).digest('hex');
  }
}
