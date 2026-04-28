import { IsEmail, IsIn, IsISO8601, IsOptional, IsString, Length } from 'class-validator';

export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(['USER', 'ADMIN', 'EDITOR'])
  role?: 'USER' | 'ADMIN' | 'EDITOR';

  // ===== Subscription =====
  @IsOptional()
  @IsIn(['CLASSIC', 'PREMIUM', 'PRO'])
  subscriptionPlan?: 'CLASSIC' | 'PREMIUM' | 'PRO';

  // ISO date (ex: 2026-02-13T12:00:00.000Z) ou null
  @IsOptional()
  @IsISO8601()
  subscriptionEndsAt?: string;
}
