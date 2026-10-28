import { BadRequestException, Injectable } from '@nestjs/common';
import { RecommendationContext } from '../types/context';
import { PrismaService } from '../../../core/prisma/prisma.service';

type MealItemWithProduct = {
  weightG: number;
  product: {
    name: string;
    calories: number;
    proteins: number;
    fats: number;
    carbs: number;
  };
};

type WeightPoint = {
  measuredAt: Date;
  weightInKg: number;
};

@Injectable()
export class RecommendationContextBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async build(userId: string): Promise<RecommendationContext> {
    const sevenDaysAgo = this.getUtcDateDaysAgo(7);

    const [user, recentMeals, reactions, reactionDetails, weightHistory] =
      await Promise.all([
        this.prisma.user.findFirst({
          where: { id: userId, deletedAt: null },
          select: {
            gender: true,
            birthDate: true,
            heightCm: true,
            currentWeight: true,
            activityLevel: true,
          },
        }),
        this.prisma.meal.findMany({
          where: { userId },
          orderBy: { timestamp: 'desc' },
          take: 3,
          select: {
            timestamp: true,
            items: {
              select: {
                weightG: true,
                product: {
                  select: {
                    name: true,
                    calories: true,
                    proteins: true,
                    fats: true,
                    carbs: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.reaction.findMany({
          where: { userId },
          select: { id: true, name: true },
        }),
        this.prisma.productReactionDetail.findMany({
          where: { userId },
          select: {
            reactionId: true,
            count: true,
          },
        }),
        this.prisma.weightHistory.findMany({
          where: {
            userId,
            measuredAt: {
              gte: sevenDaysAgo,
            },
          },
          orderBy: { measuredAt: 'asc' },
          select: {
            measuredAt: true,
            weightInKg: true,
          },
        }),
      ]);

    if (!user) {
      throw new BadRequestException('Пользователь не найден');
    }

    const age = this.calculateAge(user.birthDate);
    const weightTrend7d = this.calculateWeightTrend7d(weightHistory);
    const reactionRates = this.calculateReactionRates(reactionDetails);

    return {
      profile: {
        gender: user.gender,
        age,
        heightCm: user.heightCm,
        currentWeightKg: user.currentWeight,
        activityLevel: user.activityLevel,
        weightTrend7d,
      },
      recentMeals: recentMeals.map((meal) => ({
        timestamp: meal.timestamp,
        totals: this.calculateMealTotals(meal.items),
        items: meal.items.map((item) => item.product.name),
      })),
      reactions: reactions.map((reaction) => ({
        name: reaction.name,
        reactionRate: reactionRates.get(reaction.id) ?? 0,
      })),
    };
  }

  private calculateAge(birthDate: Date | null): number | null {
    if (!birthDate) return null;

    const now = new Date();
    let age = now.getUTCFullYear() - birthDate.getUTCFullYear();

    const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && now.getUTCDate() < birthDate.getUTCDate())
    ) {
      age -= 1;
    }

    return age;
  }

  private calculateMealTotals(items: MealItemWithProduct[]) {
    return items.reduce(
      (totals, item) => {
        totals.calories += (item.product.calories * item.weightG) / 100;
        totals.proteins += (item.product.proteins * item.weightG) / 100;
        totals.fats += (item.product.fats * item.weightG) / 100;
        totals.carbs += (item.product.carbs * item.weightG) / 100;
        return totals;
      },
      {
        calories: 0,
        proteins: 0,
        fats: 0,
        carbs: 0,
      },
    );
  }

  private calculateReactionRates(
    reactionDetails: Array<{ reactionId: string; count: number }>,
  ): Map<string, number> {
    const total = reactionDetails.reduce((sum, row) => sum + row.count, 0);
    const byReactionId = new Map<string, number>();

    for (const row of reactionDetails) {
      byReactionId.set(
        row.reactionId,
        (byReactionId.get(row.reactionId) ?? 0) + row.count,
      );
    }
    const rates = new Map<string, number>();

    for (const [reactionId, count] of byReactionId.entries()) {
      rates.set(
        reactionId,
        total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
      );
    }
    return rates;
  }

  private calculateWeightTrend7d(history: WeightPoint[]): number {
    if (history.length < 2) return 0;

    const first = history[0].weightInKg;
    const last = history[history.length - 1].weightInKg;

    return Number((last - first).toFixed(2));
  }

  private getUtcDateDaysAgo(days: number): Date {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);

    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }
}
