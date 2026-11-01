import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, SeverityLevel } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { GetStatsDayDto } from './dto/get-stats-date.dto';
import { GetStatsRangeDto } from './dto/get-stats-range.dto';
import {
  addTotals,
  calculateMealTotalsRaw,
  createEmptyTotals,
  divideTotals,
  normalizeNutritionTotals,
  sumMealsTotalsRaw,
  toMealItemBreakdown,
  type MealItemBreakdown,
  type NutritionTotals,
} from '../meals/meals.mapper';
import {
  daysBetweenInclusive,
  eachDayKey,
  endOfLocalDayUtc,
  localTodayKey,
  shiftDayKey,
  startOfLocalDayUtc,
  toLocalDayKey,
  type TimezoneOffsetMinutes,
} from '../../../shared/utils/date';
import { round2 } from '../../../shared/utils/number';

const MAX_RANGE_DAYS = 90;
const SUMMARY_WEEK_DAYS = 7;

type MealWithItemsAndReactions = Prisma.MealGetPayload<{
  include: {
    items: { include: { product: true } };
    mealReactions: { include: { reaction: true } };
  };
}>;

type MealReactionBreakdown = {
  id: string;
  reactionId: string;
  name: string;
  severity: SeverityLevel | null;
};

type MealBreakdown = {
  id: string;
  timestamp: string;
  photoUrl: string | null;
  items: MealItemBreakdown[];
  reactions: MealReactionBreakdown[];
  totals: NutritionTotals;
};

type DayBucket = {
  date: string;
  mealsCount: number;
  totals: NutritionTotals;
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

/**
 * Все границы суток здесь считаются в таймзоне пользователя — так же, как в
 * MealsService. Иначе один и тот же приём пищи, съеденный ночью, попадал бы в
 * разные дни в списке приёмов пищи и в статистике.
 */
@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  private toMealBreakdown(meal: MealWithItemsAndReactions): MealBreakdown {
    const reactions: MealReactionBreakdown[] = meal.mealReactions.map((mr) => ({
      id: mr.id,
      reactionId: mr.userReactionId,
      name: mr.reaction.name,
      severity: mr.severity,
    }));

    return {
      id: meal.id,
      timestamp: meal.timestamp.toISOString(),
      photoUrl: meal.photoUrl,
      items: meal.items.map(toMealItemBreakdown),
      reactions,
      totals: normalizeNutritionTotals(calculateMealTotalsRaw(meal)),
    };
  }

  private resolveRange(
    query: GetStatsRangeDto,
    timezoneOffsetMinutes: TimezoneOffsetMinutes,
  ) {
    const spanDays = daysBetweenInclusive(query.from, query.to);

    if (spanDays <= 0) {
      throw new BadRequestException('Некорректный диапазон дат');
    }

    if (spanDays > MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `Диапазон не может превышать ${MAX_RANGE_DAYS} дней`,
      );
    }

    return {
      start: startOfLocalDayUtc(query.from, timezoneOffsetMinutes),
      end: endOfLocalDayUtc(query.to, timezoneOffsetMinutes),
    };
  }

  async getDayStats(
    userId: string,
    query: GetStatsDayDto,
    timezoneOffsetMinutes: TimezoneOffsetMinutes,
  ): Promise<DayStatsResponse> {
    const meals = await this.prisma.meal.findMany({
      where: {
        userId,
        timestamp: {
          gte: startOfLocalDayUtc(query.date, timezoneOffsetMinutes),
          lt: endOfLocalDayUtc(query.date, timezoneOffsetMinutes),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        mealReactions: {
          include: {
            reaction: true,
          },
        },
      },
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
    });

    return {
      date: query.date,
      mealsCount: meals.length,
      meals: meals.map((meal) => this.toMealBreakdown(meal)),
      totals: normalizeNutritionTotals(sumMealsTotalsRaw(meals)),
    };
  }

  async getRangeStats(
    userId: string,
    query: GetStatsRangeDto,
    timezoneOffsetMinutes: TimezoneOffsetMinutes,
  ): Promise<RangeStatsResponse> {
    const { start, end } = this.resolveRange(query, timezoneOffsetMinutes);

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

    const days: DayBucket[] = eachDayKey(query.from, query.to).map((date) => ({
      date,
      mealsCount: 0,
      totals: createEmptyTotals(),
    }));

    const daysByKey = new Map(days.map((day) => [day.date, day] as const));

    for (const meal of meals) {
      const bucket = daysByKey.get(
        toLocalDayKey(meal.timestamp, timezoneOffsetMinutes),
      );

      if (!bucket) {
        continue;
      }

      bucket.mealsCount += 1;
      addTotals(bucket.totals, calculateMealTotalsRaw(meal));
    }

    const totalsRaw = sumMealsTotalsRaw(meals);

    return {
      period: {
        from: query.from,
        to: query.to,
      },
      mealsCount: meals.length,
      days: days.map((day) => ({
        date: day.date,
        mealsCount: day.mealsCount,
        totals: normalizeNutritionTotals(day.totals),
      })),
      totals: normalizeNutritionTotals(totalsRaw),
      averagePerDay: divideTotals(totalsRaw, days.length),
    };
  }

  async getWeightStats(
    userId: string,
    query: GetStatsRangeDto,
    timezoneOffsetMinutes: TimezoneOffsetMinutes,
  ): Promise<WeightStatsResponse> {
    const { start, end } = this.resolveRange(query, timezoneOffsetMinutes);

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
        ? round2(records[records.length - 1].weightInKg - records[0].weightInKg)
        : null;

    return {
      period: {
        from: query.from,
        to: query.to,
      },
      current: currentWeight !== null ? round2(currentWeight) : null,
      change,
      recordsCount: records.length,
      data: records.map((record) => ({
        date: toLocalDayKey(record.measuredAt, timezoneOffsetMinutes),
        weight: round2(record.weightInKg),
      })),
    };
  }

  async getSummary(
    userId: string,
    timezoneOffsetMinutes: TimezoneOffsetMinutes,
  ): Promise<SummaryResponse> {
    const todayKey = localTodayKey(timezoneOffsetMinutes);
    const weekStartKey = shiftDayKey(todayKey, -(SUMMARY_WEEK_DAYS - 1));

    const todayStart = startOfLocalDayUtc(todayKey, timezoneOffsetMinutes);
    const todayEnd = endOfLocalDayUtc(todayKey, timezoneOffsetMinutes);
    const weekStart = startOfLocalDayUtc(weekStartKey, timezoneOffsetMinutes);

    const mealsInclude = {
      items: {
        include: {
          product: true,
        },
      },
    };

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
          include: mealsInclude,
        }),
        this.prisma.meal.findMany({
          where: {
            userId,
            timestamp: {
              gte: weekStart,
              lt: todayEnd,
            },
          },
          include: mealsInclude,
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
              lt: todayEnd,
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

    const todayTotalsRaw = sumMealsTotalsRaw(todayMeals);
    const weekTotalsRaw = sumMealsTotalsRaw(weekMeals);

    const currentWeight =
      latestWeight?.weightInKg ?? user?.currentWeight ?? null;

    const change7d =
      weekWeights.length >= 2
        ? round2(
            weekWeights[weekWeights.length - 1].weightInKg -
              weekWeights[0].weightInKg,
          )
        : null;

    return {
      today: {
        date: todayKey,
        mealsCount: todayMeals.length,
        totals: normalizeNutritionTotals(todayTotalsRaw),
      },
      week: {
        from: weekStartKey,
        to: todayKey,
        mealsCount: weekMeals.length,
        totals: normalizeNutritionTotals(weekTotalsRaw),
        averagePerDay: divideTotals(weekTotalsRaw, SUMMARY_WEEK_DAYS),
      },
      weight: {
        current: currentWeight !== null ? round2(currentWeight) : null,
        change7d,
        recordsCount: weekWeights.length,
      },
    };
  }
}
