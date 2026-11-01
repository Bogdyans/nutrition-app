import { BadRequestException } from '@nestjs/common';
import { MealsService } from './meals.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ReactionStatsDomainService } from '../reactions/services/reaction-stats.domain.service';

const MOSCOW = -180; // UTC+3, конвенция Date#getTimezoneOffset()
const UTC = 0;

const meal = (id: string, timestamp: string, calories = 100) => ({
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
});

type MealFixture = ReturnType<typeof meal>;

type MealFindManyArgs = {
  where: {
    userId: string;
    timestamp: { gte: Date; lt: Date };
  };
  take: number;
  skip: number;
  cursor?: { id: string };
};

/**
 * Аргументы meal.findMany собираются в типизированный массив — так тесты
 * читают их без `any`, в который вырождается jest.Mock#mock.calls.
 */
const createService = (meals: MealFixture[] = []) => {
  const mealQueries: MealFindManyArgs[] = [];

  const prisma = {
    meal: {
      count: jest.fn().mockResolvedValue(meals.length),
      findMany: jest.fn((args: MealFindManyArgs) => {
        mealQueries.push(args);

        return Promise.resolve(meals);
      }),
      findFirst: jest.fn().mockResolvedValue(meals[0] ?? null),
    },
    // findMany оборачивает count+findMany в транзакцию-массив.
    $transaction: jest.fn((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  };

  const service = new MealsService(
    prisma as unknown as PrismaService,
    {} as ReactionStatsDomainService,
  );

  return { service, mealQueries };
};

describe('MealsService.findMany — границы суток', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('по явной дате берёт сутки в таймзоне пользователя', async () => {
    const { service, mealQueries } = createService();

    await service.findMany('user-1', { date: '2026-07-27' }, MOSCOW);

    const { where } = mealQueries[0];

    expect(where.timestamp.gte.toISOString()).toBe('2026-07-26T21:00:00.000Z');
    expect(where.timestamp.lt.toISOString()).toBe('2026-07-27T21:00:00.000Z');
  });

  it('без параметров берёт сегодняшний день пользователя, а не UTC', async () => {
    // 22:30 UTC 27-го === 01:30 28-го по Москве.
    jest.useFakeTimers().setSystemTime(new Date('2026-07-27T22:30:00.000Z'));

    const { service, mealQueries } = createService();

    await service.findMany('user-1', {}, MOSCOW);

    const { where } = mealQueries[0];

    // Сутки 28-го по Москве: с 27-го 21:00 UTC по 28-е 21:00 UTC.
    expect(where.timestamp.gte.toISOString()).toBe('2026-07-27T21:00:00.000Z');
    expect(where.timestamp.lt.toISOString()).toBe('2026-07-28T21:00:00.000Z');
  });

  it('без параметров в UTC берёт текущие сутки UTC', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-27T22:30:00.000Z'));

    const { service, mealQueries } = createService();

    await service.findMany('user-1', {}, UTC);

    const { where } = mealQueries[0];

    expect(where.timestamp.gte.toISOString()).toBe('2026-07-27T00:00:00.000Z');
    expect(where.timestamp.lt.toISOString()).toBe('2026-07-28T00:00:00.000Z');
  });

  it('поддерживает диапазон from/to', async () => {
    const { service, mealQueries } = createService();

    await service.findMany(
      'user-1',
      { from: '2026-07-25', to: '2026-07-27' },
      MOSCOW,
    );

    const { where } = mealQueries[0];

    expect(where.timestamp.gte.toISOString()).toBe('2026-07-24T21:00:00.000Z');
    expect(where.timestamp.lt.toISOString()).toBe('2026-07-27T21:00:00.000Z');
  });

  it('запрещает одновременно date и диапазон', async () => {
    const { service } = createService();

    await expect(
      service.findMany(
        'user-1',
        { date: '2026-07-27', from: '2026-07-25' },
        MOSCOW,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('отвергает перевёрнутый диапазон', async () => {
    const { service } = createService();

    await expect(
      service.findMany(
        'user-1',
        { from: '2026-07-28', to: '2026-07-25' },
        MOSCOW,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('отвергает несуществующую дату', async () => {
    const { service } = createService();

    await expect(
      service.findMany('user-1', { date: '2026-02-30' }, MOSCOW),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('MealsService.findMany — пагинация', () => {
  it('не отдаёт лишнюю запись и возвращает курсор, когда есть следующая страница', async () => {
    const meals = Array.from({ length: 3 }, (_, i) =>
      meal(`meal-${i}`, '2026-07-27T09:00:00.000Z'),
    );
    const { service, mealQueries } = createService(meals);

    const result = await service.findMany(
      'user-1',
      { date: '2026-07-27', limit: 2 },
      MOSCOW,
    );

    // limit+1 запрашивается, чтобы понять, есть ли следующая страница.
    expect(mealQueries[0].take).toBe(3);
    expect(result.data).toHaveLength(2);
    expect(result.meta.hasNextPage).toBe(true);
    expect(result.meta.nextCursor).toBe('meal-2');
  });

  it('на последней странице не возвращает курсор', async () => {
    const meals = [meal('meal-0', '2026-07-27T09:00:00.000Z')];
    const { service } = createService(meals);

    const result = await service.findMany(
      'user-1',
      { date: '2026-07-27', limit: 2 },
      MOSCOW,
    );

    expect(result.data).toHaveLength(1);
    expect(result.meta.hasNextPage).toBe(false);
    expect(result.meta.nextCursor).toBeUndefined();
  });

  it('пропускает саму запись курсора', async () => {
    const { service, mealQueries } = createService();

    await service.findMany(
      'user-1',
      { date: '2026-07-27', cursor: 'meal-5' },
      MOSCOW,
    );

    const args = mealQueries[0];

    expect(args.cursor).toEqual({ id: 'meal-5' });
    expect(args.skip).toBe(1);
  });
});

describe('MealsService.findOne', () => {
  it('пересчитывает пищевую ценность позиций на их вес', async () => {
    const { service } = createService([
      {
        ...meal('meal-1', '2026-07-27T09:00:00.000Z', 100),
        items: [
          {
            id: 'item-1',
            productId: 'product-1',
            weightG: 250,
            product: {
              name: 'Гречка',
              calories: 100,
              proteins: 10,
              fats: 5,
              carbs: 20,
            },
          },
        ],
      },
    ]);

    const result = await service.findOne('user-1', 'meal-1');

    expect(result.items[0]).toEqual({
      id: 'item-1',
      productId: 'product-1',
      productName: 'Гречка',
      weightG: 250,
      calories: 250,
      proteins: 25,
      fats: 12.5,
      carbs: 50,
    });
    expect(result.totals.calories).toBe(250);
  });
});
