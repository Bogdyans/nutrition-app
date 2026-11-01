import { BadRequestException } from '@nestjs/common';
import { StatsService } from './stats.service';
import { PrismaService } from '../../core/prisma/prisma.service';

const MOSCOW = -180; // UTC+3, конвенция Date#getTimezoneOffset()
const UTC = 0;

type MealFixture = {
  id: string;
  timestamp: Date;
  photoUrl: string | null;
  items: {
    id: string;
    productId: string;
    weightG: number;
    product: {
      name: string;
      calories: number;
      proteins: number;
      fats: number;
      carbs: number;
    };
  }[];
  mealReactions: {
    id: string;
    userReactionId: string;
    severity: null;
    reaction: { name: string };
  }[];
};

const meal = (id: string, timestamp: string, calories = 100): MealFixture => ({
  id,
  timestamp: new Date(timestamp),
  photoUrl: null,
  items: [
    {
      id: `${id}-item`,
      productId: 'product-1',
      weightG: 100,
      product: {
        name: 'Гречка',
        calories,
        proteins: 10,
        fats: 5,
        carbs: 20,
      },
    },
  ],
  mealReactions: [],
});

type MealFindManyArgs = {
  where: {
    userId: string;
    timestamp: { gte: Date; lt: Date };
  };
};

/**
 * Аргументы meal.findMany собираются в типизированный массив — так тесты
 * читают их без `any`, в который вырождается jest.Mock#mock.calls.
 */
const createService = (meals: MealFixture[] = []) => {
  const mealQueries: MealFindManyArgs[] = [];

  const prisma = {
    meal: {
      findMany: jest.fn((args: MealFindManyArgs) => {
        mealQueries.push(args);

        return Promise.resolve(meals);
      }),
    },
    weightHistory: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ currentWeight: null }),
    },
  };

  const service = new StatsService(prisma as unknown as PrismaService);

  return { service, mealQueries };
};

describe('StatsService.getDayStats', () => {
  it('запрашивает сутки по границам таймзоны пользователя, а не UTC', async () => {
    const { service, mealQueries } = createService();

    await service.getDayStats('user-1', { date: '2026-07-27' }, MOSCOW);

    const { where } = mealQueries[0];

    expect(where.timestamp.gte.toISOString()).toBe('2026-07-26T21:00:00.000Z');
    expect(where.timestamp.lt.toISOString()).toBe('2026-07-27T21:00:00.000Z');
    expect(where.userId).toBe('user-1');
  });

  it('в UTC запрашивает ровно календарные сутки UTC', async () => {
    const { service, mealQueries } = createService();

    await service.getDayStats('user-1', { date: '2026-07-27' }, UTC);

    const { where } = mealQueries[0];

    expect(where.timestamp.gte.toISOString()).toBe('2026-07-27T00:00:00.000Z');
    expect(where.timestamp.lt.toISOString()).toBe('2026-07-28T00:00:00.000Z');
  });

  it('суммирует пищевую ценность за день', async () => {
    const { service } = createService([
      meal('meal-1', '2026-07-27T09:00:00.000Z', 100),
      meal('meal-2', '2026-07-27T15:00:00.000Z', 250),
    ]);

    const result = await service.getDayStats(
      'user-1',
      { date: '2026-07-27' },
      MOSCOW,
    );

    expect(result.mealsCount).toBe(2);
    expect(result.totals.calories).toBe(350);
    expect(result.meals).toHaveLength(2);
  });

  it('отвергает несуществующую дату', async () => {
    const { service } = createService();

    await expect(
      service.getDayStats('user-1', { date: '2026-02-30' }, MOSCOW),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('StatsService.getRangeStats', () => {
  it('относит ночной приём пищи к местному дню, а не к UTC-дню', async () => {
    // 00:30 28-го по Москве === 21:30 27-го по UTC.
    const { service } = createService([
      meal('night', '2026-07-27T21:30:00.000Z', 400),
    ]);

    const result = await service.getRangeStats(
      'user-1',
      { from: '2026-07-27', to: '2026-07-28' },
      MOSCOW,
    );

    const byDate = new Map(result.days.map((day) => [day.date, day]));

    expect(byDate.get('2026-07-28')?.mealsCount).toBe(1);
    expect(byDate.get('2026-07-28')?.totals.calories).toBe(400);
    expect(byDate.get('2026-07-27')?.mealsCount).toBe(0);
  });

  it('в UTC тот же приём пищи попадает в предыдущий день', async () => {
    const { service } = createService([
      meal('night', '2026-07-27T21:30:00.000Z', 400),
    ]);

    const result = await service.getRangeStats(
      'user-1',
      { from: '2026-07-27', to: '2026-07-28' },
      UTC,
    );

    const byDate = new Map(result.days.map((day) => [day.date, day]));

    expect(byDate.get('2026-07-27')?.mealsCount).toBe(1);
    expect(byDate.get('2026-07-28')?.mealsCount).toBe(0);
  });

  it('возвращает все дни диапазона, включая пустые', async () => {
    const { service } = createService();

    const result = await service.getRangeStats(
      'user-1',
      { from: '2026-07-25', to: '2026-07-28' },
      MOSCOW,
    );

    expect(result.days.map((day) => day.date)).toEqual([
      '2026-07-25',
      '2026-07-26',
      '2026-07-27',
      '2026-07-28',
    ]);
  });

  it('делит среднее на число дней диапазона, а не на число приёмов пищи', async () => {
    const { service } = createService([
      meal('meal-1', '2026-07-25T09:00:00.000Z', 100),
      meal('meal-2', '2026-07-26T09:00:00.000Z', 300),
    ]);

    const result = await service.getRangeStats(
      'user-1',
      { from: '2026-07-25', to: '2026-07-28' },
      MOSCOW,
    );

    expect(result.totals.calories).toBe(400);
    expect(result.averagePerDay.calories).toBe(100); // 400 / 4 дня
  });

  it('отвергает перевёрнутый диапазон', async () => {
    const { service } = createService();

    await expect(
      service.getRangeStats(
        'user-1',
        { from: '2026-07-28', to: '2026-07-27' },
        MOSCOW,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('отвергает диапазон длиннее 90 дней', async () => {
    const { service } = createService();

    await expect(
      service.getRangeStats(
        'user-1',
        { from: '2026-01-01', to: '2026-12-31' },
        MOSCOW,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('принимает граничный диапазон ровно в 90 дней', async () => {
    const { service } = createService();

    const result = await service.getRangeStats(
      'user-1',
      { from: '2026-01-01', to: '2026-03-31' },
      MOSCOW,
    );

    expect(result.days).toHaveLength(90);
  });
});

describe('StatsService.getSummary', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('берёт «сегодня» по таймзоне пользователя', async () => {
    // 22:30 UTC 27-го === 01:30 28-го по Москве: для пользователя это уже 28-е.
    jest.useFakeTimers().setSystemTime(new Date('2026-07-27T22:30:00.000Z'));

    const { service } = createService();
    const result = await service.getSummary('user-1', MOSCOW);

    expect(result.today.date).toBe('2026-07-28');
    expect(result.week.to).toBe('2026-07-28');
    expect(result.week.from).toBe('2026-07-22'); // семь дней включительно
  });

  it('в UTC в тот же момент «сегодня» ещё 27-е', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-27T22:30:00.000Z'));

    const { service } = createService();
    const result = await service.getSummary('user-1', UTC);

    expect(result.today.date).toBe('2026-07-27');
  });

  it('делит недельное среднее на семь дней', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-27T12:00:00.000Z'));

    const { service } = createService([
      meal('meal-1', '2026-07-27T09:00:00.000Z', 700),
    ]);

    const result = await service.getSummary('user-1', MOSCOW);

    expect(result.week.totals.calories).toBe(700);
    expect(result.week.averagePerDay.calories).toBe(100);
  });
});
