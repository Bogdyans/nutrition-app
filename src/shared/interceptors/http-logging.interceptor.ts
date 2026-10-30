import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';

// Порог, выше которого запрос считается медленным и логируется как warn.
const SLOW_REQUEST_MS = 1000;

/**
 * Логирует завершённые запросы с длительностью. Ошибки сюда не попадают —
 * ими занимается AllExceptionsFilter, иначе каждая ошибка писалась бы дважды.
 */
@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startedAt;
          const line = `${request.method} ${request.url} -> ${response.statusCode} ${durationMs}ms [${request.requestId ?? '-'}]`;

          if (durationMs >= SLOW_REQUEST_MS) {
            this.logger.warn(`${line} SLOW`);
            return;
          }

          this.logger.log(line);
        },
      }),
    );
  }
}
