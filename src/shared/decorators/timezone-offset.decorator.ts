import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { TimezoneOffsetMinutes } from '../utils/date';

export const TIMEZONE_OFFSET_HEADER = 'x-timezone-offset';

// Реальные таймзоны укладываются в ±14 часов; всё за пределами — мусор или
// попытка сдвинуть выборку, поэтому молча откатываемся на UTC.
const MAX_OFFSET_MINUTES = 14 * 60;

export function parseTimezoneOffset(raw: unknown): TimezoneOffsetMinutes {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return 0;
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || Math.abs(parsed) > MAX_OFFSET_MINUTES) {
    return 0;
  }

  return Math.trunc(parsed);
}

/**
 * Смещение таймзоны клиента в конвенции `Date#getTimezoneOffset()`
 * (UTC минус локальное время, -180 для UTC+3). Отсутствующий или
 * некорректный заголовок означает UTC.
 */
export const TimezoneOffset = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TimezoneOffsetMinutes => {
    const request = ctx.switchToHttp().getRequest<Request>();

    return parseTimezoneOffset(request.headers[TIMEZONE_OFFSET_HEADER]);
  },
);
