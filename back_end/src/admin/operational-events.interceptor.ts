import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { catchError, Observable, throwError } from 'rxjs';
import { Repository } from 'typeorm';
import { OperationalEvent, OperationalEventType } from './entities/operational-event.entity';

@Injectable()
export class OperationalEventsInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(OperationalEvent)
    private readonly eventsRepo: Repository<OperationalEvent>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    return next.handle().pipe(
      catchError((error) => {
        const statusCode = Number(error?.getStatus?.() ?? error?.status ?? 500);
        if (statusCode >= 500) {
          const request = context.switchToHttp().getRequest();
          const path = String(request?.route?.path ?? request?.path ?? 'unknown').slice(0, 180);
          void this.record(this.eventType(path), path, statusCode);
        }
        return throwError(() => error);
      }),
    );
  }

  private eventType(path: string): OperationalEventType {
    if (path.includes('/billing')) return 'STRIPE_FAILURE';
    if (path.includes('/contact') || path.includes('/register') || path.includes('/forgot-password') || path.includes('/resend-verification')) {
      return 'EMAIL_FAILURE';
    }
    return 'API_ERROR';
  }

  private async record(type: OperationalEventType, route: string, statusCode: number): Promise<void> {
    try {
      await this.eventsRepo.save(this.eventsRepo.create({ type, route, statusCode }));
    } catch {
      // Le suivi ne doit jamais masquer ni remplacer l'erreur d'origine.
    }
  }
}
