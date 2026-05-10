// src/users/dto/admin-grant-subscription.dto.ts

import { IsIn, IsOptional, IsString } from 'class-validator';
import { SubscriptionPlan } from '../user.entity';

export type AdminGrantDuration =
  | '7d'
  | '14d'
  | '1m'
  | '3m'
  | '6m'
  | '1y'
  | 'lifetime';

export class AdminGrantSubscriptionDto {
  @IsIn(['PREMIUM', 'PRO'])
  plan: Exclude<SubscriptionPlan, 'CLASSIC'>;

  @IsIn(['7d', '14d', '1m', '3m', '6m', '1y', 'lifetime'])
  duration: AdminGrantDuration;

  @IsOptional()
  @IsString()
  note?: string;
}