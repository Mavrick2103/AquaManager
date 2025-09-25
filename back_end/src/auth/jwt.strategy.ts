/**
 * jwt.strategy.ts
 * -----------------
 * Déclare la stratégie JWT pour Passport.
 * - Extrait le token de l’en-tête Authorization: Bearer <token>
 * - Vérifie la signature avec le secret .env
 * - Ajoute { userId, email, role } dans req.user si valide
 */
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: { sub: number; email: string; role: string }) {
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
