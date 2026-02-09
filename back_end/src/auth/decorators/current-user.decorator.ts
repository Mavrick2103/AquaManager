import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;

    if (!user) return null;
    if (!data) return user;

    return user?.[data] ?? null;
  },
);
