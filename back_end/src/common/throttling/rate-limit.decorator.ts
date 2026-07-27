import { applyDecorators, ExecutionContext, UseGuards } from '@nestjs/common';
import {
  Throttle,
  ThrottlerGenerateKeyFunction,
  ThrottlerGetTrackerFunction,
  ThrottlerGuard,
} from '@nestjs/throttler';

const DEFAULT_THROTTLER = 'default';

const userTracker: ThrottlerGetTrackerFunction = (req) => {
  const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub;
  return userId == null ? req.ip : `user:${String(userId)}`;
};

const categoryKey = (category: string): ThrottlerGenerateKeyFunction =>
  (_context: ExecutionContext, tracker: string, throttlerName: string) =>
    `${throttlerName}:${category}:${tracker}`;

function rateLimit(
  limit: number,
  ttl: number,
  options?: {
    tracker?: ThrottlerGetTrackerFunction;
    category?: string;
  },
) {
  return applyDecorators(
    UseGuards(ThrottlerGuard),
    Throttle({
      [DEFAULT_THROTTLER]: {
        limit,
        ttl,
        getTracker: options?.tracker,
        generateKey: options?.category
          ? categoryKey(options.category)
          : undefined,
      },
    }),
  );
}

export const LoginRateLimit = () => rateLimit(5, 60_000);
export const RegisterRateLimit = () => rateLimit(5, 60 * 60_000);
export const ForgotPasswordRateLimit = () => rateLimit(3, 60 * 60_000);
export const ResetPasswordRateLimit = () => rateLimit(5, 60 * 60_000);
export const ContactRateLimit = () => rateLimit(5, 60 * 60_000);

export const AiRateLimit = () =>
  rateLimit(10, 60_000, { tracker: userTracker, category: 'ai' });

export const ImageUploadRateLimit = () =>
  rateLimit(10, 60_000, { tracker: userTracker, category: 'image-upload' });
