import { Global, Module, Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AquariumRetentionService } from './aquarium-retention.service';

@Injectable()
export class AquariumRetentionInterceptor implements NestInterceptor {
  constructor(private readonly retention: AquariumRetentionService) {}
  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const userId = Number(request.user?.userId);
    if (Number.isInteger(userId) && userId > 0) await this.retention.reconcile(userId);
    return next.handle();
  }
}

@Global()
@Module({
  providers: [AquariumRetentionService, { provide: APP_INTERCEPTOR, useClass: AquariumRetentionInterceptor }],
  exports: [AquariumRetentionService],
})
export class AquariumRetentionModule {}
