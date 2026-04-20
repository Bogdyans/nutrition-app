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
} from './meals.mapper';

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
  id: string;
  userReactionId: string;
  severity: SeverityLevel | null;
};

type PrismaLike = PrismaService | Prisma.TransactionClient;

@Injectable()
export class MealsService {
  constructor(private readonly prisma: PrismaService) {}

  private round2(value: number) {
    return Number(value.toFixed(2));
  }

  private unique(values: string[]) {
    return [...new Set(values)];
  }

  private startOfUtcDay(value: string | Date) {
    const date = new Date(value);
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private endOfUtcDay(value: string | Date) {
    const end = this.startOfUtcDay(value);
    end.setUTCDate(end.getUTCDate() + 1);
    return end;
  }

  private resolveRange(query: GetMealsDto) {
    if (query.date && (query.from || query.to)) {
      throw new BadRequestException('Use either date or from/to');
    }

    if (query.date) {
      const start = this.startOfUtcDay(query.date);
      const end = this.endOfUtcDay(query.date);
      return { start, end };
    }

    if (query.from || query.to) {
      const start = query.from ? this.startOfUtcDay(query.from) : new Date(0);
      const end = query.to ? this.endOfUtcDay(query.to) : new Date();

      if (start > end) {
        throw new BadRequestException('Invalid date range');
      }

      return { start, end };
    }

    const today = new Date();
    const start = this.startOfUtcDay(today);
    const end = this.endOfUtcDay(today);

    return { start, end };
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
      throw new BadRequestException(`Product ${productId} is unavailable`);
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
      throw new NotFoundException('Meal not found');
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
      throw new NotFoundException('Meal not found');
    }

    return meal;
  }

  private severityScore(severity: SeverityLevel | null | undefined) {
    switch (severity) {
      case SeverityLevel.LOW:
        return 1;
      case SeverityLevel.MEDIUM:
        return 2;
      case SeverityLevel.HIGH:
        return 3;
      default:
        return 0;
    }
  }

  private toMealResponse(meal: MealWithItems) {
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
      totals: normalizeNutritionTotals(calculateMealTotalsRaw(meal)),
    };
  }

  private async incrementMealsCount(
    tx: Prisma.TransactionClient,
    userId: string,
    productIds: string[],
  ) {
    for (const productId of this.unique(productIds)) {
      await tx.productReactionStat.upsert({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
        create: {
          userId,
          productId,
          mealsCount: 1,
          reactionMealsCount: 0,
        },
        update: {
          mealsCount: {
            increment: 1,
          },
        },
      });
    }
  }

  private async decrementMealsCount(
    tx: Prisma.TransactionClient,
    userId: string,
    productIds: string[],
  ) {
    for (const productId of this.unique(productIds)) {
      const stat = await tx.productReactionStat.findUnique({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
        select: {
          mealsCount: true,
        },
      });

      if (!stat || stat.mealsCount <= 0) {
        continue;
      }

      await tx.productReactionStat.update({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
        data: {
          mealsCount: {
            decrement: 1,
          },
        },
      });
    }
  }

  private async incrementReactionMealsCount(
    tx: Prisma.TransactionClient,
    userId: string,
    productIds: string[],
  ) {
    for (const productId of this.unique(productIds)) {
      await tx.productReactionStat.upsert({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
        create: {
          userId,
          productId,
          mealsCount: 0,
          reactionMealsCount: 1,
        },
        update: {
          reactionMealsCount: {
            increment: 1,
          },
        },
      });
    }
  }

  private async decrementReactionMealsCount(
    tx: Prisma.TransactionClient,
    userId: string,
    productIds: string[],
  ) {
    for (const productId of this.unique(productIds)) {
      const stat = await tx.productReactionStat.findUnique({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
        select: {
          reactionMealsCount: true,
        },
      });

      if (!stat || stat.reactionMealsCount <= 0) {
        continue;
      }

      await tx.productReactionStat.update({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
        data: {
          reactionMealsCount: {
            decrement: 1,
          },
        },
      });
    }
  }

  private async incrementReactionDetailsForMealProducts(
    tx: Prisma.TransactionClient,
    userId: string,
    productIds: string[],
    mealReactions: MealReactionSnapshot[],
  ) {
    const uniqueProductIds = this.unique(productIds);

    for (const productId of uniqueProductIds) {
      for (const reaction of mealReactions) {
        const severityValue = this.severityScore(reaction.severity);

        await tx.productReactionDetail.upsert({
          where: {
            userId_productId_reactionId: {
              userId,
              productId,
              reactionId: reaction.userReactionId,
            },
          },
          create: {
            userId,
            productId,
            reactionId: reaction.userReactionId,
            count: 1,
            severitySum: severityValue,
          },
          update: {
            count: {
              increment: 1,
            },
            severitySum: {
              increment: severityValue,
            },
          },
        });
      }
    }
  }

  private async decrementReactionDetailsForMealProducts(
    tx: Prisma.TransactionClient,
    userId: string,
    productIds: string[],
    mealReactions: MealReactionSnapshot[],
  ) {
    const uniqueProductIds = this.unique(productIds);

    for (const productId of uniqueProductIds) {
      for (const reaction of mealReactions) {
        const severityValue = this.severityScore(reaction.severity);

        const detail = await tx.productReactionDetail.findUnique({
          where: {
            userId_productId_reactionId: {
              userId,
              productId,
              reactionId: reaction.userReactionId,
            },
          },
          select: {
            id: true,
            count: true,
          },
        });

        if (!detail) {
          continue;
        }

        if (detail.count <= 1) {
          await tx.productReactionDetail.delete({
            where: {
              id: detail.id,
            },
          });
          continue;
        }

        await tx.productReactionDetail.update({
          where: {
            id: detail.id,
          },
          data: {
            count: {
              decrement: 1,
            },
            severitySum: {
              decrement: severityValue,
            },
          },
        });
      }
    }
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
          throw new BadRequestException('One or more products are unavailable');
        }

        await tx.mealItem.createMany({
          data: dto.items.map((item) => ({
            mealId: meal.id,
            productId: item.productId,
            weightG: item.weightG,
          })),
        });

        await this.incrementMealsCount(tx, userId, uniqueProductIds);
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

  async findMany(userId: string, query: GetMealsDto) {
    const { start, end } = this.resolveRange(query);
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
        await this.incrementMealsCount(tx, userId, [dto.productId]);

        if (meal.mealReactions.length > 0) {
          await this.incrementReactionMealsCount(tx, userId, [dto.productId]);
          await this.incrementReactionDetailsForMealProducts(
            tx,
            userId,
            [dto.productId],
            meal.mealReactions,
          );
        }
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
        throw new NotFoundException('Meal item not found');
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
        await this.decrementMealsCount(tx, userId, [item.productId]);

        if (meal.mealReactions.length > 0) {
          await this.decrementReactionDetailsForMealProducts(
            tx,
            userId,
            [item.productId],
            meal.mealReactions,
          );
          await this.decrementReactionMealsCount(tx, userId, [item.productId]);
        }
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

  async updateMeal(userId: string, mealId: string, dto: UpdateMealDto) {
    await this.getMealOwnedByUserOrThrow(this.prisma, userId, mealId);

    const updated = await this.prisma.meal.update({
      where: { id: mealId },
      data: {
        timestamp: dto.timestamp ? new Date(dto.timestamp) : undefined,
        photoUrl: dto.photoUrl !== undefined ? dto.photoUrl : undefined,
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
    await this.getMealOwnedByUserOrThrow(this.prisma, userId, mealId);

    const item = await this.prisma.mealItem.findFirst({
      where: {
        id: itemId,
        mealId,
      },
      select: { id: true },
    });

    if (!item) {
      throw new NotFoundException('Meal item not found');
    }

    await this.prisma.mealItem.update({
      where: { id: itemId },
      data: {
        weightG: dto.weightG,
      },
    });

    return this.findOne(userId, mealId);
  }

  async deleteMeal(userId: string, mealId: string) {
    return this.prisma.$transaction(async (tx) => {
      const meal = await this.getMealForStatsSyncOrThrow(tx, userId, mealId);

      const productIds = this.unique(meal.items.map((item) => item.productId));

      await this.decrementMealsCount(tx, userId, productIds);

      if (meal.mealReactions.length > 0) {
        await this.decrementReactionDetailsForMealProducts(
          tx,
          userId,
          productIds,
          meal.mealReactions,
        );
        await this.decrementReactionMealsCount(tx, userId, productIds);

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
