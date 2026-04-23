import { Injectable } from '@nestjs/common';
import { Prisma, SeverityLevel } from '@prisma/client';

type Tx = Prisma.TransactionClient;

type ReactionSnapshot = {
  reactionId: string;
  severity: SeverityLevel | null;
};

@Injectable()
export class ReactionStatsDomainService {
  private unique(values: string[]) {
    return [...new Set(values)];
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

  async applyProductsAddedToMeal(
    tx: Tx,
    userId: string,
    productIds: string[],
    reactionSnapshots: ReactionSnapshot[] = [],
  ) {
    const uniqueProductIds = this.unique(productIds);
    const hasReactions = reactionSnapshots.length > 0;

    for (const productId of uniqueProductIds) {
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
          reactionMealsCount: hasReactions ? 1 : 0,
        },
        update: {
          mealsCount: {
            increment: 1,
          },
          ...(hasReactions
            ? {
                reactionMealsCount: {
                  increment: 1,
                },
              }
            : {}),
        },
      });
    }

    if (!hasReactions) {
      return;
    }

    for (const productId of uniqueProductIds) {
      for (const reaction of reactionSnapshots) {
        const severityValue = this.severityScore(reaction.severity);

        await tx.productReactionDetail.upsert({
          where: {
            userId_productId_reactionId: {
              userId,
              productId,
              reactionId: reaction.reactionId,
            },
          },
          create: {
            userId,
            productId,
            reactionId: reaction.reactionId,
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

  async applyProductsRemovedFromMeal(
    tx: Tx,
    userId: string,
    productIds: string[],
    reactionSnapshots: ReactionSnapshot[] = [],
  ) {
    const uniqueProductIds = this.unique(productIds);
    const hasReactions = reactionSnapshots.length > 0;

    for (const productId of uniqueProductIds) {
      await tx.productReactionStat.updateMany({
        where: {
          userId,
          productId,
          mealsCount: {
            gt: 0,
          },
        },
        data: {
          mealsCount: {
            decrement: 1,
          },
        },
      });
    }

    if (!hasReactions) {
      return;
    }

    for (const productId of uniqueProductIds) {
      await tx.productReactionStat.updateMany({
        where: {
          userId,
          productId,
          reactionMealsCount: {
            gt: 0,
          },
        },
        data: {
          reactionMealsCount: {
            decrement: 1,
          },
        },
      });
    }

    for (const productId of uniqueProductIds) {
      for (const reaction of reactionSnapshots) {
        const severityValue = this.severityScore(reaction.severity);

        const detail = await tx.productReactionDetail.findUnique({
          where: {
            userId_productId_reactionId: {
              userId,
              productId,
              reactionId: reaction.reactionId,
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

  async applyReactionAddedToMeal(
    tx: Tx,
    userId: string,
    productIds: string[],
    reaction: ReactionSnapshot,
    shouldIncrementReactionMealsCount: boolean,
  ) {
    const uniqueProductIds = this.unique(productIds);
    const severityValue = this.severityScore(reaction.severity);

    if (shouldIncrementReactionMealsCount) {
      for (const productId of uniqueProductIds) {
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

    for (const productId of uniqueProductIds) {
      await tx.productReactionDetail.upsert({
        where: {
          userId_productId_reactionId: {
            userId,
            productId,
            reactionId: reaction.reactionId,
          },
        },
        create: {
          userId,
          productId,
          reactionId: reaction.reactionId,
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

  async applyReactionRemovedFromMeal(
    tx: Tx,
    userId: string,
    productIds: string[],
    reaction: ReactionSnapshot,
    shouldDecrementReactionMealsCount: boolean,
  ) {
    const uniqueProductIds = this.unique(productIds);
    const severityValue = this.severityScore(reaction.severity);

    for (const productId of uniqueProductIds) {
      const detail = await tx.productReactionDetail.findUnique({
        where: {
          userId_productId_reactionId: {
            userId,
            productId,
            reactionId: reaction.reactionId,
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
      } else {
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

    if (!shouldDecrementReactionMealsCount) {
      return;
    }

    for (const productId of uniqueProductIds) {
      await tx.productReactionStat.updateMany({
        where: {
          userId,
          productId,
          reactionMealsCount: {
            gt: 0,
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
}
