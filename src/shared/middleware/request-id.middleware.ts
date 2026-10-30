import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

declare module 'express' {
  interface Request {
    requestId?: string;
  }
}

/**
 * Присваивает каждому запросу идентификатор и возвращает его в заголовке
 * ответа. Он же попадает в логи и в тело ошибки, так что по жалобе
 * пользователя можно найти конкретный запрос в логах.
 *
 * Идентификатор из входящего заголовка переиспользуется — так цепочка
 * сохраняется, если перед приложением стоит прокси, который его уже проставил.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const requestId =
      typeof incoming === 'string' && incoming.trim() !== ''
        ? incoming
        : randomUUID();

    req.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    next();
  }
}
