import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';

type JwtPayload = { sub: number; role: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.users.findByEmailWithPassword(email);
    if (!user) throw new UnauthorizedException('Email ou mot de passe invalide');

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
    return { id: user.id, fullName: user.fullName, email: user.email };
  }

  signAccess(payload: JwtPayload) {
    const expiresIn = process.env.JWT_EXPIRES;
    return this.jwt.signAsync(payload, { expiresIn });
  }

  signRefresh(payload: JwtPayload) {
    const expiresIn = process.env.JWT_REFRESH_EXPIRES;
    return this.jwt.signAsync(payload, { expiresIn });
  }

  verifyRefresh(token: string) {
    return this.jwt.verifyAsync<JwtPayload>(token);
  }
}
