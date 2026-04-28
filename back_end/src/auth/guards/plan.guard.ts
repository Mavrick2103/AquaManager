import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLAN_KEY, SubscriptionPlan } from '../decorators/plan.decorator';
import { UsersService } from '../../users/users.service';

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<SubscriptionPlan | undefined>(
      PLAN_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    // pas de plan demandé => ok
    if (!required) return true;

    const req = ctx.switchToHttp().getRequest();
    const jwtUser = req.user;

    if (!jwtUser) throw new ForbiddenException('Not authenticated');

    const role = String(jwtUser?.role ?? 'USER').toUpperCase();

    // ADMIN bypass
    if (role === 'ADMIN') return true;

    const userId = Number(jwtUser?.userId ?? jwtUser?.id ?? jwtUser?.sub);
    if (!Number.isFinite(userId)) throw new ForbiddenException('Missing user');

    const ok = await this.usersService.hasAtLeastPlan(userId, required);
    if (!ok) throw new ForbiddenException('Plan requis');

    return true;
  }
}