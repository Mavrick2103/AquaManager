import { Body, Controller, Post, Res, Req } from '@nestjs/common';
import type { Response, Request } from 'express';

import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';

import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from '../users/dto/login.dto';

import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import {
  ForgotPasswordRateLimit,
  LoginRateLimit,
  RegisterRateLimit,
  ResetPasswordRateLimit,
} from '../common/throttling/rate-limit.decorator';

const isProd = process.env.NODE_ENV === 'production';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true as const,
  secure: isProd,
  sameSite: 'strict' as const,
  path: '/api/auth',
  maxAge: 1000 * 60 * 60 * 24 * 15,
};

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @LoginRateLimit()
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { access, refresh } = await this.auth.login(dto.email, dto.password);
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
    res.cookie('refresh_token', refresh, REFRESH_COOKIE_OPTIONS);
    return { access_token: access };
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ access_token: string | null }> {
    const refresh = req.cookies?.['refresh_token'];
    if (!refresh) return { access_token: null };

    try {
      const { access, refresh: newRefresh } = await this.auth.refreshTokens(refresh);
      res.cookie('refresh_token', newRefresh, REFRESH_COOKIE_OPTIONS);
      return { access_token: access };
    } catch {
      return { access_token: null };
    }
  }

  @Public()
  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response, @Req() req: Request) {
    await this.auth.logout(req.cookies?.['refresh_token']);
    res.clearCookie('refresh_token', { path: REFRESH_COOKIE_OPTIONS.path });
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
    return { message: 'ok' };
  }

  @Public()
  @Post('resend-verification')
  @ForgotPasswordRateLimit()
  resendVerification(@Body() dto: ForgotPasswordDto) {
    return this.auth.resendVerification(dto.email);
  }

  @Public()
  @Post('register')
  @RegisterRateLimit()
  register(@Body() dto: CreateUserDto) {
    return this.auth.register(dto);
  }

  @Public()
@Post('verify-email')
async verifyEmail(
  @Body() dto: VerifyEmailDto,
  @Res({ passthrough: true }) res: Response,
) {
  const result = await this.auth.verifyEmail(dto.token);

  if (result.ok && result.refresh) {
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
    res.cookie('refresh_token', result.refresh, REFRESH_COOKIE_OPTIONS);
  }

  return {
    ok: result.ok,
    message: result.message,
    access_token: result.access,
  };
}

  @Public()
  @Post('forgot-password')
  @ForgotPasswordRateLimit()
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @ResetPasswordRateLimit()
  resetPassword(@Body() dto: ResetPasswordDto) {
   return this.auth.resetPassword(dto.token, dto.newPassword);
  }

}
