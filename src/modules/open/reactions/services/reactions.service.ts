import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MealReaction, Prisma } from '@prisma/client';
import { AddMealReactionsDto } from '../dto/add-reaction-to-meal.dto';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { ReactionStatsDomainService } from './reaction-stats.domain.service';

@Injectable()
export class ReactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: ReactionStatsDomainService,
  ) {}

  private async lockMealOrThrow(
    client: Prisma.TransactionClient,
    userId: string,
    mealId: string,
  ) {
    const rows = await client.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM "meals"
      WHERE id = ${mealId}
        AND "user_id" = ${userId}
      FOR UPDATE
    `;

    if (rows.length === 0) {
      throw new NotFoundException('Meal not found');
    }
  }

  async addToMeal(userId: string, mealId: string, dto: AddMealReactionsDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockMealOrThrow(tx, userId, mealId);

      const meal = await tx.meal.findFirst({
        where: { id: mealId, userId },
        include: {
          items: true,
          mealReactions: true,
        },
      });

      if (!meal) {
        throw new NotFoundException('Meal not found');
      }

      if (!meal.items.length) {
        throw new BadRequestException('Meal has no products');
      }

      const dtoReactionIds = dto.reactions.map((r) => r.reactionId);
      const uniqueDtoReactionIds = new Set(dtoReactionIds);

      if (uniqueDtoReactionIds.size !== dtoReactionIds.length) {
        throw new BadRequestException('Duplicate reactions');
      }

      const alreadyAddedReactionIds = new Set(
        meal.mealReactions.map((reaction) => reaction.userReactionId),
      );

      if (
        dto.reactions.some((reaction) =>
          alreadyAddedReactionIds.has(reaction.reactionId),
        )
      ) {
        throw new BadRequestException('Reaction already added to meal');
      }

      const reactions = await tx.reaction.findMany({
        where: {
          id: { in: dtoReactionIds },
          userId,
        },
      });

      if (reactions.length !== dtoReactionIds.length) {
        throw new BadRequestException('Invalid reactions');
      }

      const productIds = [...new Set(meal.items.map((i) => i.productId))];
      let shouldIncrementReactionMealsCount = meal.mealReactions.length === 0;

      const created: MealReaction[] = [];

      for (const item of dto.reactions) {
        const createdReaction = await tx.mealReaction.create({
          data: {
            mealId,
            userReactionId: item.reactionId,
            severity: item.severity ?? null,
          },
        });

        created.push(createdReaction);

        await this.stats.applyReactionAddedToMeal(
          tx,
          userId,
          productIds,
          {
            reactionId: item.reactionId,
            severity: item.severity ?? null,
          },
          shouldIncrementReactionMealsCount,
        );

        shouldIncrementReactionMealsCount = false;
      }

      return created;
    });
  }

  async removeFromMeal(userId: string, mealReactionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const mealReaction = await tx.mealReaction.findFirst({
        where: {
          id: mealReactionId,
          meal: { userId },
        },
        include: {
          meal: {
            include: {
              items: true,
              mealReactions: true,
            },
          },
        },
      });

      if (!mealReaction) {
        throw new NotFoundException('Meal reaction not found');
      }

      await this.lockMealOrThrow(tx, userId, mealReaction.mealId);

      const productIds = [
        ...new Set(mealReaction.meal.items.map((i) => i.productId)),
      ];

      const shouldDecrementReactionMealsCount =
        mealReaction.meal.mealReactions.length === 1;

      await this.stats.applyReactionRemovedFromMeal(
        tx,
        userId,
        productIds,
        {
          reactionId: mealReaction.userReactionId,
          severity: mealReaction.severity,
        },
        shouldDecrementReactionMealsCount,
      );

      await tx.mealReaction.delete({
        where: { id: mealReactionId },
      });

      return { success: true };
    });
  }

  async getProductStats(userId: string, productId: string) {
    const stat = await this.prisma.productReactionStat.findUnique({
      where: {
        userId_productId: { userId, productId },
      },
    });

    const details = await this.prisma.productReactionDetail.findMany({
      where: { userId, productId },
      include: {
        reaction: true,
      },
      orderBy: [{ count: 'desc' }],
    });

    return {
      productId,
      mealsCount: stat?.mealsCount ?? 0,
      reactionMealsCount: stat?.reactionMealsCount ?? 0,
      reactionRate:
        stat && stat.mealsCount > 0
          ? stat.reactionMealsCount / stat.mealsCount
          : 0,
      reactions: details.map((d) => ({
        reactionId: d.reactionId,
        name: d.reaction.name,
        count: d.count,
        severitySum: d.severitySum,
        avgSeverity: d.count > 0 ? d.severitySum / d.count : 0,
      })),
    };
  }
}
