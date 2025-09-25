/**
 * public.decorator.ts
 * ---------------------
 * Marque une route comme publique (pas de JWT requis).
 * À utiliser sur /auth/login et /users (signup) par ex.
 */
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
