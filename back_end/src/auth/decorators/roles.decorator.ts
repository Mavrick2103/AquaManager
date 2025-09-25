/**
 * roles.decorator.ts
 * --------------------
 * Décorateur @Roles(...roles) pour restreindre l'accès par rôle.
 * Ex: @Roles('ADMIN')
 */
import { SetMetadata } from '@nestjs/common';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
