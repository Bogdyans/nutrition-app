import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AddMealReactionsDto } from '../dto/add-reaction-to-meal.dto';
import { MealReaction, SeverityLevel } from '@prisma/client';
import { severityScore } from '../../../../shared/consts/reactions';
import { PrismaService } from '../../../core/prisma/prisma.service';

@Injectable()
export class ReactionsService {
  constructor(private prisma: PrismaService) {}

  async addToMeal(userId: string, mealId: string, dto: AddMealReactionsDto) {
    return this.prisma.$transaction(async (tx) => {
      const meal = await tx.meal.findFirst({
        where: { id: mealId, userId },
        include: {
          items: true,
          mealReactions: true,
        },
      });

      if (!meal) throw new NotFoundException('Meal not found');
      if (!meal.items.length) {
        throw new BadRequestException('Meal has no products');
      }

      const productIds = [...new Set(meal.items.map((i) => i.productId))];
      const hadReactionsBefore = meal.mealReactions.length > 0;

      const reactions = await tx.reaction.findMany({
        where: {
          id: { in: dto.reactions.map((r) => r.reactionId) },
          userId,
        },
      });

      if (reactions.length !== dto.reactions.length) {
        throw new BadRequestException('Invalid reactions');
      }

      const created: MealReaction[] = [];

      for (const item of dto.reactions) {
        const createdReaction = await tx.mealReaction.create({
          data: {
            mealId,
            userReactionId: item.reactionId,
            severity: (item.severity?.toUpperCase() as SeverityLevel) ?? null,
          },
        });

        created.push(createdReaction);

        const severityValue = item.severity ? severityScore[item.severity] : 0;

        for (const productId of productIds) {
          await tx.productReactionDetail.upsert({
            where: {
              userId_productId_reactionId: {
                userId,
                productId,
                reactionId: item.reactionId,
              },
            },
            create: {
              userId,
              productId,
              reactionId: item.reactionId,
              count: 1,
              severitySum: severityValue,
            },
            update: {
              count: { increment: 1 },
              severitySum: { increment: severityValue },
            },
          });

          if (!hadReactionsBefore) {
            await tx.productReactionStat.upsert({
              where: {
                userId_productId: { userId, productId },
              },
              create: {
                userId,
                productId,
                mealsCount: 0,
                reactionMealsCount: 1,
              },
              update: {
                reactionMealsCount: { increment: 1 },
              },
            });
          }
        }
      }

      return created;
    });
  }

  // ---------------- REMOVE ----------------

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
        throw new NotFoundException();
      }

      const productIds = [
        ...new Set(mealReaction.meal.items.map((i) => i.productId)),
      ];

      const remaining = mealReaction.meal.mealReactions.length - 1;

      const severityValue = mealReaction.severity
        ? severityScore[mealReaction.severity]
        : 0;

      await tx.mealReaction.delete({
        where: { id: mealReactionId },
      });

      for (const productId of productIds) {
        await tx.productReactionDetail.update({
          where: {
            userId_productId_reactionId: {
              userId,
              productId,
              reactionId: mealReaction.userReactionId,
            },
          },
          data: {
            count: { decrement: 1 },
            severitySum: { decrement: severityValue },
          },
        });

        const detail = await tx.productReactionDetail.findUnique({
          where: {
            userId_productId_reactionId: {
              userId,
              productId,
              reactionId: mealReaction.userReactionId,
            },
          },
        });

        if (detail && detail.count <= 0) {
          await tx.productReactionDetail.delete({
            where: { id: detail.id },
          });
        }

        if (remaining === 0) {
          await tx.productReactionStat.update({
            where: {
              userId_productId: { userId, productId },
            },
            data: {
              reactionMealsCount: { decrement: 1 },
            },
          });
        }
      }

      return { success: true };
    });
  }

  // ---------------- STATS ----------------

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
