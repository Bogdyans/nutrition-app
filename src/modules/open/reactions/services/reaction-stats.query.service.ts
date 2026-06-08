import { Injectable, NotFoundException } from '@nestjs/common';
import { SeverityLevel } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';

type ProductReactionBreakdown = {
  reactionId: string;
  name: string;
  count: number;
  avgSeverity: number;
};

type ProductReactionStatsItem = {
  productId: string;
  productName: string;
  mealsCount: number;
  reactionMealsCount: number;
  reactionRate: number;
  topReactions: ProductReactionBreakdown[];
};

type ProductsReactionStatsResponse = {
  productsCount: number;
  products: ProductReactionStatsItem[];
};

type ReactionOverviewItem = {
  reactionId: string;
  name: string;
  totalCount: number;
  productsCount: number;
  avgSeverity: number;
};

type ReactionsOverviewResponse = {
  totalReactionEvents: number;
  reactions: ReactionOverviewItem[];
};

type ReactionDetailProduct = {
  productId: string;
  productName: string;
  count: number;
  avgSeverity: number;
};

type ReactionDetailMeal = {
  mealId: string;
  timestamp: string;
  severity: SeverityLevel | null;
  products: { productId: string; name: string }[];
};

type ReactionDetailsResponse = {
  reactionId: string;
  name: string;
  totalCount: number;
  productsCount: number;
  avgSeverity: number;
  topProducts: ReactionDetailProduct[];
  recentMeals: ReactionDetailMeal[];
};

const TOP_REACTIONS_PER_PRODUCT = 3;
const DEFAULT_PRODUCTS_LIMIT = 50;
const TOP_PRODUCTS_PER_REACTION = 6;
const RECENT_MEALS_LIMIT = 8;

@Injectable()
export class ReactionStatsQueryService {
  constructor(private readonly prisma: PrismaService) {}

  private round2(value: number) {
    return Number(value.toFixed(2));
  }

  /**
   * Продукты, на которые у пользователя есть реакции, отсортированные по ДОЛЕ
   * приёмов пищи с реакцией (reactionRate), а не по числу реакций. Для каждого
   * продукта — топ реакций.
   */
  async getProductsStats(
    userId: string,
    limit = DEFAULT_PRODUCTS_LIMIT,
  ): Promise<ProductsReactionStatsResponse> {
    const allStats = await this.prisma.productReactionStat.findMany({
      where: {
        userId,
        reactionMealsCount: { gt: 0 },
      },
      include: {
        product: { select: { id: true, name: true } },
      },
    });

    if (allStats.length === 0) {
      return { productsCount: 0, products: [] };
    }

    // reactionRate (доля приёмов с реакцией) — это вычисляемое значение, поэтому
    // сортируем в памяти. Число продуктов с реакциями у пользователя невелико.
    const stats = allStats
      .map((stat) => ({
        stat,
        rate:
          stat.mealsCount > 0 ? stat.reactionMealsCount / stat.mealsCount : 0,
      }))
      .sort(
        (a, b) =>
          b.rate - a.rate ||
          b.stat.reactionMealsCount - a.stat.reactionMealsCount,
      )
      .slice(0, limit)
      .map((entry) => entry.stat);

    const productIds = stats.map((stat) => stat.productId);

    const details = await this.prisma.productReactionDetail.findMany({
      where: {
        userId,
        productId: { in: productIds },
      },
      include: {
        reaction: { select: { id: true, name: true } },
      },
      orderBy: [{ count: 'desc' }],
    });

    const detailsByProduct = new Map<string, ProductReactionBreakdown[]>();
    for (const detail of details) {
      const bucket = detailsByProduct.get(detail.productId) ?? [];
      bucket.push({
        reactionId: detail.reactionId,
        name: detail.reaction.name,
        count: detail.count,
        avgSeverity:
          detail.count > 0 ? this.round2(detail.severitySum / detail.count) : 0,
      });
      detailsByProduct.set(detail.productId, bucket);
    }

    const products = stats.map((stat) => ({
      productId: stat.productId,
      productName: stat.product.name,
      mealsCount: stat.mealsCount,
      reactionMealsCount: stat.reactionMealsCount,
      reactionRate:
        stat.mealsCount > 0
          ? this.round2(stat.reactionMealsCount / stat.mealsCount)
          : 0,
      topReactions: (detailsByProduct.get(stat.productId) ?? []).slice(
        0,
        TOP_REACTIONS_PER_PRODUCT,
      ),
    }));

    return {
      productsCount: products.length,
      products,
    };
  }

  /**
   * Сводка по реакциям: сколько раз каждая реакция встречалась и на скольких
   * продуктах, со средней силой реакции.
   */
  async getOverview(userId: string): Promise<ReactionsOverviewResponse> {
    const [grouped, reactions] = await Promise.all([
      this.prisma.productReactionDetail.groupBy({
        by: ['reactionId'],
        where: { userId },
        _sum: { count: true, severitySum: true },
        // Каждая строка уникальна по (userId, productId, reactionId),
        // поэтому число строк в группе = число продуктов с этой реакцией.
        _count: { productId: true },
      }),
      this.prisma.reaction.findMany({
        where: { userId },
        select: { id: true, name: true },
      }),
    ]);

    const nameById = new Map(reactions.map((r) => [r.id, r.name] as const));

    const items: ReactionOverviewItem[] = grouped
      .map((group) => {
        const totalCount = group._sum.count ?? 0;
        const severitySum = group._sum.severitySum ?? 0;

        return {
          reactionId: group.reactionId,
          name: nameById.get(group.reactionId) ?? 'Без названия',
          totalCount,
          productsCount: group._count.productId,
          avgSeverity:
            totalCount > 0 ? this.round2(severitySum / totalCount) : 0,
        };
      })
      .sort((a, b) => b.totalCount - a.totalCount);

    const totalReactionEvents = items.reduce(
      (sum, item) => sum + item.totalCount,
      0,
    );

    return {
      totalReactionEvents,
      reactions: items,
    };
  }

  /**
   * Детали по одной реакции: продукты, которые её чаще всего вызывают, и
   * последние приёмы пищи, на которых она была отмечена.
   */
  async getReactionDetails(
    userId: string,
    reactionId: string,
  ): Promise<ReactionDetailsResponse> {
    const reaction = await this.prisma.reaction.findFirst({
      where: { id: reactionId, userId },
      select: { id: true, name: true },
    });

    if (!reaction) {
      throw new NotFoundException('Reaction not found');
    }

    const [details, mealReactions] = await Promise.all([
      this.prisma.productReactionDetail.findMany({
        where: { userId, reactionId },
        include: { product: { select: { id: true, name: true } } },
        orderBy: [{ count: 'desc' }],
      }),
      this.prisma.mealReaction.findMany({
        where: {
          userReactionId: reactionId,
          meal: { userId },
        },
        include: {
          meal: {
            include: {
              items: {
                include: { product: { select: { id: true, name: true } } },
              },
            },
          },
        },
        orderBy: { meal: { timestamp: 'desc' } },
        take: RECENT_MEALS_LIMIT,
      }),
    ]);

    const totalCount = details.reduce((sum, d) => sum + d.count, 0);
    const severitySum = details.reduce((sum, d) => sum + d.severitySum, 0);

    const topProducts: ReactionDetailProduct[] = details
      .slice(0, TOP_PRODUCTS_PER_REACTION)
      .map((detail) => ({
        productId: detail.productId,
        productName: detail.product.name,
        count: detail.count,
        avgSeverity:
          detail.count > 0 ? this.round2(detail.severitySum / detail.count) : 0,
      }));

    const recentMeals: ReactionDetailMeal[] = mealReactions.map((mr) => {
      const seen = new Set<string>();
      const products: { productId: string; name: string }[] = [];

      for (const item of mr.meal.items) {
        if (seen.has(item.productId)) continue;
        seen.add(item.productId);
        products.push({ productId: item.productId, name: item.product.name });
      }

      return {
        mealId: mr.mealId,
        timestamp: mr.meal.timestamp.toISOString(),
        severity: mr.severity,
        products,
      };
    });

    return {
      reactionId: reaction.id,
      name: reaction.name,
      totalCount,
      productsCount: details.length,
      avgSeverity: totalCount > 0 ? this.round2(severitySum / totalCount) : 0,
      topProducts,
      recentMeals,
    };
  }
}
