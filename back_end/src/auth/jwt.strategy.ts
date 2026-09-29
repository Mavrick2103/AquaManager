import { AuthSessionService, SessionPayload } from './auth-session.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: ConfigService, private readonly sessions: AuthSessionService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: SessionPayload) {
    if (payload.kind !== 'access') throw new UnauthorizedException('Jeton d’accès requis');
    const user = await this.sessions.validate(payload);
    return { userId: user.id, role: user.role.toUpperCase() };
  }
}
