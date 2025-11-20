import { Body, Controller, Post, Res, Req } from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { CreateUserDto } from '../users/dto/create-user.dto';

const isProd = process.env.NODE_ENV === 'production';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true as const,
  secure: isProd,
  sameSite: 'strict' as const,
  path: '/api/auth/refresh',
  maxAge: 1000 * 60 * 60 * 24 * 15,
};


@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access, refresh } = await this.auth.login(body.email, body.password);
    res.cookie('refresh_token', refresh, REFRESH_COOKIE_OPTIONS);
    return { access_token: access };
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refresh = req.cookies?.['refresh_token'];
    if (!refresh) {
      return { access_token: null };
    }

    // Vérifie le refresh
    let payload: any;
    try {
      payload = await this.auth.verifyRefresh(refresh);
    } catch {
      return { access_token: null };
    }

    const access = await this.auth.signAccess({
      sub: payload.sub,
      role: payload.role,
    });

    const newRefresh = await this.auth.signRefresh({
      sub: payload.sub,
      role: payload.role,
    });
    res.cookie('refresh_token', newRefresh, REFRESH_COOKIE_OPTIONS);

    return { access_token: access };
  }

  @Public()
  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('refresh_token', { path: REFRESH_COOKIE_OPTIONS.path });
    return { message: 'ok' };
  }

  @Public()
  @Post('register')
  register(@Body() dto: CreateUserDto) {
    return this.auth.register(dto);
  }
}
