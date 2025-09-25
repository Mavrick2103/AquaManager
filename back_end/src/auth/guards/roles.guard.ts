/**
 * roles.guard.ts
 * ----------------
 * Vérifie que l'utilisateur authentifié possède l'un des rôles requis.
 * Utilisé avec @Roles('ADMIN'), etc.
 */
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user?.role) throw new ForbiddenException('Missing role');
    if (!required.includes(user.role)) throw new ForbiddenException('Insufficient role');
    return true;
  }
}
