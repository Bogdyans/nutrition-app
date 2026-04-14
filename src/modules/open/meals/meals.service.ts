import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductVisibility } from '@prisma/client';
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

type MealStatsProjection = Prisma.MealGetPayload<{
  select: {
    items: {
      select: {
        weightG: true;
        product: {
          select: {
            calories: true;
            proteins: true;
            fats: true;
            carbs: true;
          };
        };
      };
    };
  };
}>;

@Injectable()
export class MealsService {
  constructor(private readonly prisma: PrismaService) {}

  private round2(value: number) {
    return Number(value.toFixed(2));
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

  private async assertMealOwnership(userId: string, mealId: string) {
    const meal = await this.prisma.meal.findFirst({
      where: { id: mealId, userId },
      select: { id: true },
    });

    if (!meal) {
      throw new NotFoundException('Meal not found');
    }
  }

  private toMealResponse(meal: MealWithItems) {
    const items = meal.items.map((item) => {
      const factor = item.weightG / 100;

      return {
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        weightG: item.weightG,
        calories: this.round2(item.product.calories * factor),
        proteins: this.round2(item.product.proteins * factor),
        fats: this.round2(item.product.fats * factor),
        carbs: this.round2(item.product.carbs * factor),
      };
    });

    const totals = normalizeNutritionTotals(calculateMealTotalsRaw(meal));

    return {
      id: meal.id,
      timestamp: meal.timestamp,
      photoUrl: meal.photoUrl,
      items,
      totals,
    };
  }

  private async getAccessibleProductOrThrow(userId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
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

  private async getMealOwnedByUserOrThrow(userId: string, mealId: string) {
    const meal = await this.prisma.meal.findFirst({
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
        const uniqueProductIds = [
          ...new Set(dto.items.map((item) => item.productId)),
        ];

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
    const meal = await this.getMealOwnedByUserOrThrow(userId, mealId);
    return this.toMealResponse(meal);
  }

  async addItem(userId: string, mealId: string, dto: AddMealItemDto) {
    await this.assertMealOwnership(userId, mealId);
    await this.getAccessibleProductOrThrow(userId, dto.productId);

    await this.prisma.mealItem.create({
      data: {
        mealId,
        productId: dto.productId,
        weightG: dto.weightG,
      },
    });

    return this.findOne(userId, mealId);
  }

  async removeItem(userId: string, mealId: string, itemId: string) {
    await this.assertMealOwnership(userId, mealId);

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

    await this.prisma.mealItem.delete({
      where: {
        id: itemId,
      },
    });

    return this.findOne(userId, mealId);
  }

  async getStats(userId: string, query: GetMealsDto) {
    const { start, end } = this.resolveRange(query);

    const meals = await this.prisma.meal.findMany({
      where: {
        userId,
        timestamp: {
          gte: start,
          lt: end,
        },
      },
      select: {
        items: {
          select: {
            weightG: true,
            product: {
              select: {
                calories: true,
                proteins: true,
                fats: true,
                carbs: true,
              },
            },
          },
        },
      },
    });

    const totalsRaw = meals.reduce(
      (acc, meal) => {
        const mealTotals = calculateMealTotalsRaw(meal as MealStatsProjection);

        acc.calories += mealTotals.calories;
        acc.proteins += mealTotals.proteins;
        acc.fats += mealTotals.fats;
        acc.carbs += mealTotals.carbs;

        return acc;
      },
      { calories: 0, proteins: 0, fats: 0, carbs: 0 },
    );

    return {
      period: {
        from: start,
        to: end,
      },
      mealsCount: meals.length,
      totals: normalizeNutritionTotals(totalsRaw),
    };
  }

  async updateMeal(userId: string, mealId: string, dto: UpdateMealDto) {
    await this.assertMealOwnership(userId, mealId);

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
    await this.assertMealOwnership(userId, mealId);

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
    await this.assertMealOwnership(userId, mealId);

    await this.prisma.meal.delete({
      where: { id: mealId },
    });

    return { success: true };
  }
}
