import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHash } from 'crypto';
import { AuthSession } from './auth-session.entity';
import { UsersService } from '../users/users.service';

export interface SessionPayload {
  sub: number;
  role: string;
  sid: string;
  version: number;
  kind?: 'access' | 'refresh';
}

@Injectable()
export class AuthSessionService {
  constructor(
    @InjectRepository(AuthSession) private readonly repo: Repository<AuthSession>,
    private readonly users: UsersService,
  ) {}

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async create(payload: SessionPayload, refresh: string, expiresAt: Date) {
    await this.repo.insert({ id: payload.sid, userId: payload.sub, refreshHash: this.hash(refresh), expiresAt });
  }

  async validate(payload: SessionPayload) {
    if (!Number.isInteger(payload.sub) || !payload.sid || !Number.isInteger(payload.version)) {
      throw new UnauthorizedException('Session invalide');
    }
    const [user, session] = await Promise.all([
      this.users.findById(payload.sub),
      this.repo.findOneBy({ id: payload.sid, userId: payload.sub, expiresAt: MoreThan(new Date()) }),
    ]);
    if (!user?.emailVerifiedAt || user.authVersion !== payload.version || !session) {
      throw new UnauthorizedException('Session expirée ou révoquée');
    }
    return user;
  }

  async rotate(payload: SessionPayload, oldToken: string, newToken: string, expiresAt: Date) {
    // Compare-and-swap: only one request can consume a given refresh token.
    const result = await this.repo.update(
      { id: payload.sid, userId: payload.sub, refreshHash: this.hash(oldToken), expiresAt: MoreThan(new Date()) },
      { refreshHash: this.hash(newToken), expiresAt },
    );
    if (result.affected !== 1) throw new UnauthorizedException('Jeton déjà utilisé ou révoqué');
  }

  async revoke(payload: SessionPayload) {
    await this.repo.delete({ id: payload.sid, userId: payload.sub });
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpired() {
    await this.repo.delete({ expiresAt: LessThanOrEqual(new Date()) });
  }
}
