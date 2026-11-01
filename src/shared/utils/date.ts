import { BadRequestException } from '@nestjs/common';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Смещение таймзоны во всём проекте задаётся в конвенции JS
 * `Date#getTimezoneOffset()` — UTC минус локальное время в минутах, то есть
 * для UTC+3 (Москва) это -180. Клиент присылает его в заголовке
 * `x-timezone-offset`, разбором занимается декоратор `@TimezoneOffset()`.
 *
 * Локальная полночь переводится в UTC прибавлением смещения:
 * 00:00 27-го в UTC+3 === 26-го 21:00 UTC === Date.UTC(27) + (-180 мин).
 */
export type TimezoneOffsetMinutes = number;

/** Календарный день даты в UTC, в формате `ГГГГ-ММ-ДД`. */
export function toDayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Строгий разбор `ГГГГ-ММ-ДД` в полночь UTC. Отвергает несуществующие даты. */
export function parseDateOnly(value: string): Date {
  if (!DATE_ONLY_PATTERN.test(value)) {
    throw new BadRequestException('Используйте формат даты ГГГГ-ММ-ДД');
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  // Date.UTC нормализует переполнение (2026-02-30 -> 2026-03-02), поэтому
  // сверяем результат с исходной строкой.
  if (toDayKey(parsed) !== value) {
    throw new BadRequestException('Некорректная дата');
  }

  return parsed;
}

/** Календарный день даты в таймзоне пользователя. */
export function toLocalDayKey(
  value: Date,
  timezoneOffsetMinutes: TimezoneOffsetMinutes,
): string {
  return toDayKey(new Date(value.getTime() - timezoneOffsetMinutes * 60_000));
}

/** Момент UTC, в который в таймзоне пользователя начинается указанный день. */
export function startOfLocalDayUtc(
  dayKey: string,
  timezoneOffsetMinutes: TimezoneOffsetMinutes,
): Date {
  const day = parseDateOnly(dayKey);

  return new Date(day.getTime() + timezoneOffsetMinutes * 60_000);
}

/** Момент UTC, в который в таймзоне пользователя начинается следующий день. */
export function endOfLocalDayUtc(
  dayKey: string,
  timezoneOffsetMinutes: TimezoneOffsetMinutes,
): Date {
  return new Date(
    startOfLocalDayUtc(dayKey, timezoneOffsetMinutes).getTime() + DAY_MS,
  );
}

/** Сегодняшний календарный день в таймзоне пользователя. */
export function localTodayKey(
  timezoneOffsetMinutes: TimezoneOffsetMinutes,
): string {
  return toLocalDayKey(new Date(), timezoneOffsetMinutes);
}

/** Сдвиг календарного дня на указанное число суток. */
export function shiftDayKey(dayKey: string, days: number): string {
  const shifted = new Date(parseDateOnly(dayKey).getTime() + days * DAY_MS);

  return toDayKey(shifted);
}

/** Число суток между двумя днями включительно: с 01 по 01 — это 1 день. */
export function daysBetweenInclusive(fromKey: string, toKey: string): number {
  const span =
    parseDateOnly(toKey).getTime() - parseDateOnly(fromKey).getTime();

  return Math.round(span / DAY_MS) + 1;
}

/** Все календарные дни от `fromKey` до `toKey` включительно. */
export function eachDayKey(fromKey: string, toKey: string): string[] {
  const days: string[] = [];
  const end = parseDateOnly(toKey).getTime();

  for (
    let cursor = parseDateOnly(fromKey).getTime();
    cursor <= end;
    cursor += DAY_MS
  ) {
    days.push(toDayKey(new Date(cursor)));
  }

  return days;
}

export function normalizeDate(input: string): Date {
  const date = new Date(input);

  if (isNaN(date.getTime())) {
    throw new BadRequestException('Некорректный формат даты');
  }

  // Обнуляем время ВСЕГДА
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}
