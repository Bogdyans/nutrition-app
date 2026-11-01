import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductVisibility, SeverityLevel } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateMealDto } from './dto/create-meal.dto';
import { AddMealItemDto } from './dto/add-meal-item.dto';
import { GetMealsDto } from './dto/get-meals.dto';
import { UpdateMealDto } from './dto/update-meal.dto';
import { UpdateMealItemDto } from './dto/update-meal-item.dto';
import {
  calculateMealTotalsRaw,
  normalizeNutritionTotals,
  toMealItemBreakdown,
} from './meals.mapper';
import {
  endOfLocalDayUtc,
  localTodayKey,
  startOfLocalDayUtc,
  type TimezoneOffsetMinutes,
} from '../../../shared/utils/date';
import { ReactionStatsDomainService } from '../reactions/services/reaction-stats.domain.service';

type MealWithItems = Prisma.MealGetPayload<{
  include: {
    items: {
      include: {
        product: true;
      };
    };
  };
}>;

type MealItemSnapshot = {
  id: string;
  productId: string;
};

type MealReactionSnapshot = {
  reactionId: string;
  severity: SeverityLevel | null;
};

type PrismaLike = PrismaService | Prisma.TransactionClient;

@Injectable()
export class MealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: ReactionStatsDomainService,
  ) {}

  private unique(values: string[]) {
    return [...new Set(values)];
  }

  private resolveRange(
    query: GetMealsDto,
    timezoneOffsetMinutes: TimezoneOffsetMinutes,
  ) {
    if (query.date && (query.from || query.to)) {
      throw new BadRequestException(
        'Укажите либо конкретную дату, либо диапазон дат',
      );
    }

    if (query.date) {
      return {
        start: startOfLocalDayUtc(query.date, timezoneOffsetMinutes),
        end: endOfLocalDayUtc(query.date, timezoneOffsetMinutes),
      };
    }

    if (query.from || query.to) {
      const start = query.from
        ? startOfLocalDayUtc(query.from, timezoneOffsetMinutes)
        : new Date(0);

      const end = query.to
        ? endOfLocalDayUtc(query.to, timezoneOffsetMinutes)
        : new Date();

      if (start > end) {
        throw new BadRequestException('Некорректный диапазон дат');
      }

      return { start, end };
    }

    const today = localTodayKey(timezoneOffsetMinutes);

    return {
      start: startOfLocalDayUtc(today, timezoneOffsetMinutes),
      end: endOfLocalDayUtc(today, timezoneOffsetMinutes),
    };
  }

  private async lockMealOrThrow(
    client: PrismaLike,
    userId: string,
    mealId: string,
  ) {
    const rows = await (client as Prisma.TransactionClient).$queryRaw<
      { id: string }[]
    >`
      SELECT id
      FROM "meals"
      WHERE id = ${mealId}
        AND "user_id" = ${userId}
      FOR UPDATE
    `;

    if (rows.length === 0) {
      throw new NotFoundException('Приём пищи не найден');
    }
  }

  private async getAccessibleProductOrThrow(
    client: PrismaLike,
    userId: string,
    productId: string,
  ) {
    const product = await client.product.findFirst({
      where: {
        id: productId,
        deletedAt: null,
        OR: [
          { ownerId: userId },
          { visibility: ProductVisibility.SHARED },
          { visibility: ProductVisibility.PUBLIC },
        ],
      },
      select: { id: true },
    });

    if (!product) {
      throw new BadRequestException(`Продукт ${productId} недоступен`);
    }

    return product;
  }

  private async getMealOwnedByUserOrThrow(
    client: PrismaLike,
    userId: string,
    mealId: string,
  ) {
    const meal = await client.meal.findFirst({
      where: {
        id: mealId,
        userId,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!meal) {
      throw new NotFoundException('Приём пищи не найден');
    }

    return meal;
  }

  private async getMealForStatsSyncOrThrow(
    client: PrismaLike,
    userId: string,
    mealId: string,
  ) {
    const meal = await client.meal.findFirst({
      where: {
        id: mealId,
        userId,
      },
      select: {
        id: true,
        items: {
          select: {
            id: true,
            productId: true,
          },
        },
        mealReactions: {
          select: {
            id: true,
            userReactionId: true,
            severity: true,
          },
        },
      },
    });

    if (!meal) {
      throw new NotFoundException('Приём пищи не найден');
    }

    return meal;
  }

  private toMealReactionSnapshots(
    mealReactions: {
      userReactionId: string;
      severity: SeverityLevel | null;
    }[],
  ): MealReactionSnapshot[] {
    return mealReactions.map((reaction) => ({
      reactionId: reaction.userReactionId,
      severity: reaction.severity,
    }));
  }

  private toMealResponse(meal: MealWithItems) {
    return {
      id: meal.id,
      timestamp: meal.timestamp.toISOString(),
      photoUrl: meal.photoUrl,
      items: meal.items.map(toMealItemBreakdown),
      totals: normalizeNutritionTotals(calculateMealTotalsRaw(meal)),
    };
  }

  async create(userId: string, dto: CreateMealDto) {
    const timestamp = dto.timestamp ? new Date(dto.timestamp) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const meal = await tx.meal.create({
        data: {
          userId,
          timestamp,
          photoUrl: dto.photoUrl?.trim() || null,
        },
      });

      if (dto.items?.length) {
        const uniqueProductIds = this.unique(
          dto.items.map((item) => item.productId),
        );

        const accessibleProducts = await tx.product.findMany({
          where: {
            id: { in: uniqueProductIds },
            deletedAt: null,
            OR: [
              { ownerId: userId },
              { visibility: ProductVisibility.SHARED },
              { visibility: ProductVisibility.PUBLIC },
            ],
          },
          select: { id: true },
        });

        if (accessibleProducts.length !== uniqueProductIds.length) {
          throw new BadRequestException(
            'Один или несколько продуктов недоступны',
          );
        }

        await tx.mealItem.createMany({
          data: dto.items.map((item) => ({
            mealId: meal.id,
            productId: item.productId,
            weightG: item.weightG,
          })),
        });

        await this.stats.applyProductsAddedToMeal(tx, userId, uniqueProductIds);
      }

      const created = await tx.meal.findUniqueOrThrow({
        where: { id: meal.id },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      return this.toMealResponse(created);
    });
  }

  async findMany(
    userId: string,
    query: GetMealsDto,
    timezoneOffsetMinutes: TimezoneOffsetMinutes,
  ) {
    const { start, end } = this.resolveRange(query, timezoneOffsetMinutes);
    const limit = query.limit ?? 10;

    const where: Prisma.MealWhereInput = {
      userId,
      timestamp: {
        gte: start,
        lt: end,
      },
    };

    const [totalCount, meals] = await this.prisma.$transaction([
      this.prisma.meal.count({ where }),
      this.prisma.meal.findMany({
        take: limit + 1,
        cursor: query.cursor ? { id: query.cursor } : undefined,
        skip: query.cursor ? 1 : 0,
        where,
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
        orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      }),
    ]);

    let nextCursor: string | undefined;

    if (meals.length > limit) {
      const next = meals.pop();
      nextCursor = next?.id;
    }

    return {
      data: meals.map((meal) => this.toMealResponse(meal)),
      meta: {
        totalCount,
        nextCursor,
        hasNextPage: Boolean(nextCursor),
      },
    };
  }

  async findOne(userId: string, mealId: string) {
    const meal = await this.getMealOwnedByUserOrThrow(
      this.prisma,
      userId,
      mealId,
    );

    return this.toMealResponse(meal);
  }

  async addItem(userId: string, mealId: string, dto: AddMealItemDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockMealOrThrow(tx, userId, mealId);

      const meal = await this.getMealForStatsSyncOrThrow(tx, userId, mealId);
      await this.getAccessibleProductOrThrow(tx, userId, dto.productId);

      const productAlreadyInMeal = meal.items.some(
        (item) => item.productId === dto.productId,
      );

      await tx.mealItem.create({
        data: {
          mealId,
          productId: dto.productId,
          weightG: dto.weightG,
        },
      });

      if (!productAlreadyInMeal) {
        await this.stats.applyProductsAddedToMeal(
          tx,
          userId,
          [dto.productId],
          this.toMealReactionSnapshots(meal.mealReactions),
        );
      }

      const updated = await tx.meal.findUniqueOrThrow({
        where: { id: mealId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      return this.toMealResponse(updated);
    });
  }

  async removeItem(userId: string, mealId: string, itemId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockMealOrThrow(tx, userId, mealId);

      const meal = await this.getMealForStatsSyncOrThrow(tx, userId, mealId);

      const item = await tx.mealItem.findFirst({
        where: {
          id: itemId,
          mealId,
        },
        select: {
          id: true,
          productId: true,
        },
      });

      if (!item) {
        throw new NotFoundException('Позиция приёма пищи не найдена');
      }

      const sameProductCount = meal.items.filter(
        (mealItem: MealItemSnapshot) => mealItem.productId === item.productId,
      ).length;

      await tx.mealItem.delete({
        where: {
          id: itemId,
        },
      });

      if (sameProductCount === 1) {
        await this.stats.applyProductsRemovedFromMeal(
          tx,
          userId,
          [item.productId],
          this.toMealReactionSnapshots(meal.mealReactions),
        );
      }

      const isLastItem = meal.items.length === 1;

      if (isLastItem) {
        await tx.meal.delete({
          where: { id: mealId },
        });

        return null;
      }

      // 3. Если предметы еще остались, обновляем и возвращаем meal
      const updated = await tx.meal.findUniqueOrThrow({
        where: { id: mealId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      return this.toMealResponse(updated);
    });
  }
  async updateMeal(userId: string, mealId: string, dto: UpdateMealDto) {
    await this.getMealOwnedByUserOrThrow(this.prisma, userId, mealId);

    const updated = await this.prisma.meal.update({
      where: { id: mealId },
      data: {
        timestamp: dto.timestamp ? new Date(dto.timestamp) : undefined,
        photoUrl:
          dto.photoUrl === undefined
            ? undefined
            : dto.photoUrl === null
              ? null
              : dto.photoUrl.trim() || null,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return this.toMealResponse(updated);
  }

  async updateItem(
    userId: string,
    mealId: string,
    itemId: string,
    dto: UpdateMealItemDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockMealOrThrow(tx, userId, mealId);

      await this.getMealOwnedByUserOrThrow(tx, userId, mealId);

      const item = await tx.mealItem.findFirst({
        where: {
          id: itemId,
          mealId,
        },
        select: { id: true },
      });

      if (!item) {
        throw new NotFoundException('Позиция приёма пищи не найдена');
      }

      await tx.mealItem.update({
        where: { id: itemId },
        data: {
          weightG: dto.weightG,
        },
      });

      const updated = await tx.meal.findUniqueOrThrow({
        where: { id: mealId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      return this.toMealResponse(updated);
    });
  }

  async deleteMeal(userId: string, mealId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockMealOrThrow(tx, userId, mealId);

      const meal = await this.getMealForStatsSyncOrThrow(tx, userId, mealId);

      const productIds = this.unique(meal.items.map((item) => item.productId));

      if (productIds.length > 0) {
        await this.stats.applyProductsRemovedFromMeal(
          tx,
          userId,
          productIds,
          this.toMealReactionSnapshots(meal.mealReactions),
        );
      }

      if (meal.mealReactions.length > 0) {
        await tx.mealReaction.deleteMany({
          where: {
            mealId,
          },
        });
      }

      await tx.meal.delete({
        where: { id: mealId },
      });

      return { success: true };
    });
  }
}
