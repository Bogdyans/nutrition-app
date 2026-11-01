import { BadRequestException } from '@nestjs/common';
import {
  daysBetweenInclusive,
  eachDayKey,
  endOfLocalDayUtc,
  localTodayKey,
  parseDateOnly,
  shiftDayKey,
  startOfLocalDayUtc,
  toDayKey,
  toLocalDayKey,
} from './date';

// Смещения в конвенции Date#getTimezoneOffset(): UTC минус локальное время.
const MOSCOW = -180; // UTC+3
const NEW_YORK = 300; // UTC-5
const UTC = 0;

describe('parseDateOnly', () => {
  it('разбирает календарный день в полночь UTC', () => {
    expect(parseDateOnly('2026-07-27').toISOString()).toBe(
      '2026-07-27T00:00:00.000Z',
    );
  });

  it('отвергает формат с временем', () => {
    expect(() => parseDateOnly('2026-07-27T10:00:00Z')).toThrow(
      BadRequestException,
    );
  });

  it('отвергает несуществующую дату вместо переполнения в следующий месяц', () => {
    expect(() => parseDateOnly('2026-02-30')).toThrow(BadRequestException);
  });

  it('принимает високосное 29 февраля', () => {
    expect(toDayKey(parseDateOnly('2024-02-29'))).toBe('2024-02-29');
  });
});

describe('startOfLocalDayUtc', () => {
  it('для UTC+3 начинает день в 21:00 предыдущих суток UTC', () => {
    expect(startOfLocalDayUtc('2026-07-27', MOSCOW).toISOString()).toBe(
      '2026-07-26T21:00:00.000Z',
    );
  });

  it('для UTC-5 начинает день в 05:00 тех же суток UTC', () => {
    expect(startOfLocalDayUtc('2026-07-27', NEW_YORK).toISOString()).toBe(
      '2026-07-27T05:00:00.000Z',
    );
  });

  it('для UTC совпадает с полуночью UTC', () => {
    expect(startOfLocalDayUtc('2026-07-27', UTC).toISOString()).toBe(
      '2026-07-27T00:00:00.000Z',
    );
  });
});

describe('endOfLocalDayUtc', () => {
  it('отстоит от начала дня ровно на сутки', () => {
    const start = startOfLocalDayUtc('2026-07-27', MOSCOW);
    const end = endOfLocalDayUtc('2026-07-27', MOSCOW);

    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('стыкуется с началом следующего дня без зазора и нахлёста', () => {
    expect(endOfLocalDayUtc('2026-07-27', MOSCOW).toISOString()).toBe(
      startOfLocalDayUtc('2026-07-28', MOSCOW).toISOString(),
    );
  });
});

describe('toLocalDayKey', () => {
  it('относит ночной приём пищи к местному, а не к UTC-дню', () => {
    // 01:30 28-го по Москве — это ещё 22:30 27-го по UTC.
    const lateNightMoscow = new Date('2026-07-27T22:30:00.000Z');

    expect(toLocalDayKey(lateNightMoscow, MOSCOW)).toBe('2026-07-28');
    expect(toDayKey(lateNightMoscow)).toBe('2026-07-27');
  });

  it('относит вечерний приём пищи в UTC-5 к текущему местному дню', () => {
    // 20:00 27-го в Нью-Йорке — это уже 01:00 28-го по UTC.
    const eveningNewYork = new Date('2026-07-28T01:00:00.000Z');

    expect(toLocalDayKey(eveningNewYork, NEW_YORK)).toBe('2026-07-27');
    expect(toDayKey(eveningNewYork)).toBe('2026-07-28');
  });

  it('согласован с границами дня: момент внутри дня даёт тот же ключ', () => {
    const start = startOfLocalDayUtc('2026-07-27', MOSCOW);
    const justBeforeEnd = new Date(
      endOfLocalDayUtc('2026-07-27', MOSCOW).getTime() - 1,
    );

    expect(toLocalDayKey(start, MOSCOW)).toBe('2026-07-27');
    expect(toLocalDayKey(justBeforeEnd, MOSCOW)).toBe('2026-07-27');
  });
});

describe('localTodayKey', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('в UTC+3 после полуночи по местному времени возвращает уже новый день', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-27T22:30:00.000Z'));

    expect(localTodayKey(MOSCOW)).toBe('2026-07-28');
    expect(localTodayKey(UTC)).toBe('2026-07-27');
  });
});

describe('shiftDayKey', () => {
  it('сдвигает день назад через границу месяца', () => {
    expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('сдвигает день вперёд через границу года', () => {
    expect(shiftDayKey('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('daysBetweenInclusive', () => {
  it('считает один и тот же день как одни сутки', () => {
    expect(daysBetweenInclusive('2026-07-27', '2026-07-27')).toBe(1);
  });

  it('считает неделю как семь суток', () => {
    expect(daysBetweenInclusive('2026-07-21', '2026-07-27')).toBe(7);
  });

  it('возвращает неположительное значение для перевёрнутого диапазона', () => {
    expect(
      daysBetweenInclusive('2026-07-27', '2026-07-26'),
    ).toBeLessThanOrEqual(0);
  });
});

describe('eachDayKey', () => {
  it('перечисляет обе границы диапазона', () => {
    expect(eachDayKey('2026-07-25', '2026-07-28')).toEqual([
      '2026-07-25',
      '2026-07-26',
      '2026-07-27',
      '2026-07-28',
    ]);
  });

  it('для одного дня возвращает один элемент', () => {
    expect(eachDayKey('2026-07-27', '2026-07-27')).toEqual(['2026-07-27']);
  });

  it('длина совпадает с daysBetweenInclusive', () => {
    expect(eachDayKey('2026-07-01', '2026-07-31')).toHaveLength(
      daysBetweenInclusive('2026-07-01', '2026-07-31'),
    );
  });
});
