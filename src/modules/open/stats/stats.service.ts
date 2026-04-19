import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { GetStatsDayDto } from './dto/get-stats-date.dto';
import { GetStatsRangeDto } from './dto/get-stats-range.dto';
import {
  calculateMealTotalsRaw,
  normalizeNutritionTotals,
} from '../meals/meals.mapper';

const MAX_RANGE_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

type RawNutritionTotals = {
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
};

type NutritionTotals = RawNutritionTotals;

type MealWithItems = Prisma.MealGetPayload<{
  include: {
    items: {
      include: {
        product: true;
      };
    };
  };
}>;

type MealItemBreakdown = {
  id: string;
  productId: string;
  productName: string;
  weightG: number;
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
};

type MealBreakdown = {
  id: string;
  timestamp: string;
  photoUrl: string | null;
  items: MealItemBreakdown[];
  totals: NutritionTotals;
};

type DayBucket = {
  date: string;
  mealsCount: number;
  totals: RawNutritionTotals;
};

type DayStatsResponse = {
  date: string;
  mealsCount: number;
  meals: MealBreakdown[];
  totals: NutritionTotals;
};

type RangeDayResponse = {
  date: string;
  mealsCount: number;
  totals: NutritionTotals;
};

type RangeStatsResponse = {
  period: {
    from: string;
    to: string;
  };
  mealsCount: number;
  days: RangeDayResponse[];
  totals: NutritionTotals;
  averagePerDay: NutritionTotals;
};

type WeightPoint = {
  date: string;
  weight: number;
};

type WeightStatsResponse = {
  period: {
    from: string;
    to: string;
  };
  current: number | null;
  change: number | null;
  recordsCount: number;
  data: WeightPoint[];
};

type SummaryResponse = {
  today: {
    date: string;
    mealsCount: number;
    totals: NutritionTotals;
  };
  week: {
    from: string;
    to: string;
    mealsCount: number;
    totals: NutritionTotals;
    averagePerDay: NutritionTotals;
  };
  weight: {
    current: number | null;
    change7d: number | null;
    recordsCount: number;
  };
};

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  private createEmptyRawTotals(): RawNutritionTotals {
    return { calories: 0, proteins: 0, fats: 0, carbs: 0 };
  }

  private round2(value: number) {
    return Number(value.toFixed(2));
  }

  private toNormalizedTotals(totals: RawNutritionTotals): NutritionTotals {
    return normalizeNutritionTotals(totals);
  }

  private addRawTotals(target: RawNutritionTotals, source: RawNutritionTotals) {
    target.calories += source.calories;
    target.proteins += source.proteins;
    target.fats += source.fats;
    target.carbs += source.carbs;
  }

  private parseDateOnly(value: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      throw new BadRequestException('Use date format YYYY-MM-DD');
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (parsed.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException('Invalid calendar date');
    }

    return parsed;
  }

  private startOfUtcDay(value: string | Date) {
    const date = typeof value === 'string' ? this.parseDateOnly(value) : value;

    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private endOfUtcDay(value: string | Date) {
    const end = this.startOfUtcDay(value);
    end.setUTCDate(end.getUTCDate() + 1);
    return end;
  }

  private addUtcDays(value: Date, days: number) {
    const result = new Date(value);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }

  private toDayKey(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private buildDays(start: Date, endExclusive: Date) {
    const days: DayBucket[] = [];
    let cursor = new Date(start);

    while (cursor < endExclusive) {
      days.push({
        date: this.toDayKey(cursor),
        mealsCount: 0,
        totals: this.createEmptyRawTotals(),
      });

      cursor = this.addUtcDays(cursor, 1);
    }

    return days;
  }

  private sumMealsTotalsRaw(meals: MealWithItems[]) {
    return meals.reduce<RawNutritionTotals>((acc, meal) => {
      this.addRawTotals(acc, calculateMealTotalsRaw(meal));
      return acc;
    }, this.createEmptyRawTotals());
  }

  private divideTotals(
    totals: RawNutritionTotals,
    divisor: number,
  ): NutritionTotals {
    if (divisor <= 0) {
      return this.toNormalizedTotals(this.createEmptyRawTotals());
    }

    return this.toNormalizedTotals({
      calories: totals.calories / divisor,
      proteins: totals.proteins / divisor,
      fats: totals.fats / divisor,
      carbs: totals.carbs / divisor,
    });
  }

  private toMealBreakdown(meal: MealWithItems): MealBreakdown {
    const items = meal.items.map((item) => {
      const factor = item.weightG / 100;

      return {
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        weightG: this.round2(item.weightG),
        calories: this.round2(item.product.calories * factor),
        proteins: this.round2(item.product.proteins * factor),
        fats: this.round2(item.product.fats * factor),
        carbs: this.round2(item.product.carbs * factor),
      };
    });

    return {
      id: meal.id,
      timestamp: meal.timestamp.toISOString(),
      photoUrl: meal.photoUrl,
      items,
      totals: this.toNormalizedTotals(calculateMealTotalsRaw(meal)),
    };
  }

  private resolveDayRange(date: string) {
    const start = this.startOfUtcDay(date);
    const end = this.endOfUtcDay(date);
    return { start, end };
  }

  private resolveRange(query: GetStatsRangeDto) {
    const start = this.startOfUtcDay(query.from);
    const end = this.endOfUtcDay(query.to);

    if (start > end) {
      throw new BadRequestException('Invalid date range');
    }

    const spanDays = (end.getTime() - start.getTime()) / DAY_MS;
    if (spanDays > MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `Range cannot exceed ${MAX_RANGE_DAYS} days`,
      );
    }

    return { start, end };
  }

  async getDayStats(
    userId: string,
    query: GetStatsDayDto,
  ): Promise<DayStatsResponse> {
    const { start, end } = this.resolveDayRange(query.date);

    const meals = await this.prisma.meal.findMany({
      where: {
        userId,
        timestamp: {
          gte: start,
          lt: end,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
    });

    const totalsRaw = this.sumMealsTotalsRaw(meals);

    return {
      date: query.date,
      mealsCount: meals.length,
      meals: meals.map((meal) => this.toMealBreakdown(meal)),
      totals: this.toNormalizedTotals(totalsRaw),
    };
  }

  async getRangeStats(
    userId: string,
    query: GetStatsRangeDto,
  ): Promise<RangeStatsResponse> {
    const { start, end } = this.resolveRange(query);

    const meals = await this.prisma.meal.findMany({
      where: {
        userId,
        timestamp: {
          gte: start,
          lt: end,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
    });

    const days = this.buildDays(start, end);
    const daysByKey = new Map(days.map((day) => [day.date, day] as const));

    for (const meal of meals) {
      const bucket = daysByKey.get(this.toDayKey(meal.timestamp));
      if (!bucket) {
        continue;
      }

      bucket.mealsCount += 1;
      this.addRawTotals(bucket.totals, calculateMealTotalsRaw(meal));
    }

    const totalsRaw = this.sumMealsTotalsRaw(meals);
    const daysResponse: RangeDayResponse[] = days.map((day) => ({
      date: day.date,
      mealsCount: day.mealsCount,
      totals: this.toNormalizedTotals(day.totals),
    }));

    return {
      period: {
        from: query.from,
        to: query.to,
      },
      mealsCount: meals.length,
      days: daysResponse,
      totals: this.toNormalizedTotals(totalsRaw),
      averagePerDay: this.divideTotals(totalsRaw, days.length),
    };
  }

  async getWeightStats(
    userId: string,
    query: GetStatsRangeDto,
  ): Promise<WeightStatsResponse> {
    const { start, end } = this.resolveRange(query);

    const [user, records] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { currentWeight: true },
      }),
      this.prisma.weightHistory.findMany({
        where: {
          userId,
          measuredAt: {
            gte: start,
            lt: end,
          },
        },
        select: {
          measuredAt: true,
          weightInKg: true,
        },
        orderBy: [{ measuredAt: 'asc' }],
      }),
    ]);

    const currentWeight =
      records.at(-1)?.weightInKg ?? user?.currentWeight ?? null;

    const change =
      records.length >= 2
        ? this.round2(
            records[records.length - 1].weightInKg - records[0].weightInKg,
          )
        : null;

    return {
      period: {
        from: query.from,
        to: query.to,
      },
      current: currentWeight !== null ? this.round2(currentWeight) : null,
      change,
      recordsCount: records.length,
      data: records.map((record) => ({
        date: this.toDayKey(record.measuredAt),
        weight: this.round2(record.weightInKg),
      })),
    };
  }

  async getSummary(userId: string): Promise<SummaryResponse> {
    const todayStart = this.startOfUtcDay(new Date());
    const todayEnd = this.endOfUtcDay(todayStart);
    const weekStart = this.addUtcDays(todayStart, -6);
    const weekEnd = todayEnd;

    const [todayMeals, weekMeals, latestWeight, weekWeights, user] =
      await Promise.all([
        this.prisma.meal.findMany({
          where: {
            userId,
            timestamp: {
              gte: todayStart,
              lt: todayEnd,
            },
          },
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        }),
        this.prisma.meal.findMany({
          where: {
            userId,
            timestamp: {
              gte: weekStart,
              lt: weekEnd,
            },
          },
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        }),
        this.prisma.weightHistory.findFirst({
          where: { userId },
          select: {
            weightInKg: true,
          },
          orderBy: [{ measuredAt: 'desc' }],
        }),
        this.prisma.weightHistory.findMany({
          where: {
            userId,
            measuredAt: {
              gte: weekStart,
              lt: weekEnd,
            },
          },
          select: {
            measuredAt: true,
            weightInKg: true,
          },
          orderBy: [{ measuredAt: 'asc' }],
        }),
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { currentWeight: true },
        }),
      ]);

    const todayTotalsRaw = this.sumMealsTotalsRaw(todayMeals);
    const weekTotalsRaw = this.sumMealsTotalsRaw(weekMeals);

    const currentWeight =
      latestWeight?.weightInKg ?? user?.currentWeight ?? null;

    const change7d =
      weekWeights.length >= 2
        ? this.round2(
            weekWeights[weekWeights.length - 1].weightInKg -
              weekWeights[0].weightInKg,
          )
        : null;

    return {
      today: {
        date: this.toDayKey(todayStart),
        mealsCount: todayMeals.length,
        totals: this.toNormalizedTotals(todayTotalsRaw),
      },
      week: {
        from: this.toDayKey(weekStart),
        to: this.toDayKey(todayStart),
        mealsCount: weekMeals.length,
        totals: this.toNormalizedTotals(weekTotalsRaw),
        averagePerDay: this.divideTotals(weekTotalsRaw, 7),
      },
      weight: {
        current: currentWeight !== null ? this.round2(currentWeight) : null,
        change7d,
        recordsCount: weekWeights.length,
      },
    };
  }
}
