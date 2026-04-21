import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { buildRecommendationPrompt } from '../const/prompts';
import { GroqService } from './groq.service';

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: GroqService,
  ) {}

  async generateAndSave(userId: string) {
    // 1. Собираем контекст
    const context = await this.buildContext(userId);

    // 2. Формируем промпт
    const prompt = buildRecommendationPrompt(context);

    // 3. Запрашиваем у Gemini
    this.logger.log(`Генерация рекомендации для пользователя ${userId}`);
    const content = await this.ai.generateText(prompt);

    // 4. Сохраняем
    const recommendation = await this.prisma.recommendation.create({
      data: {
        userId,
        content, // string (Markdown)
      },
    });

    return {
      id: recommendation.id,
      createdAt: recommendation.createdAt,
      content,
    };
  }

  async findLatest(userId: string) {
    return this.prisma.recommendation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
  }

  private async buildContext(userId: string) {
    const [user, recentMeals, reactions, reactionStats] = await Promise.all([
      this.prisma.user.findUnique({
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
        include: {
          items: {
            include: { product: true },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 3,
      }),
      this.prisma.reaction.findMany({
        where: { userId },
        select: { id: true, name: true },
      }),
      this.prisma.productReactionStat.findMany({
        where: { userId },
        include: { product: { select: { name: true } } },
        orderBy: { reactionMealsCount: 'desc' },
        take: 5,
      }),
    ]);

    if (!user) throw new BadRequestException('Пользователь не найден');

    const age = user.birthDate
      ? Math.floor(
          (Date.now() - user.birthDate.getTime()) /
            (1000 * 60 * 60 * 24 * 365.25),
        )
      : null;

    const mealsFormatted = recentMeals.map((meal) => ({
      timestamp: meal.timestamp,
      totals: {
        calories: meal.items.reduce(
          (sum, i) => sum + (i.product.calories * i.weightG) / 100,
          0,
        ),
        proteins: meal.items.reduce(
          (sum, i) => sum + (i.product.proteins * i.weightG) / 100,
          0,
        ),
        fats: meal.items.reduce(
          (sum, i) => sum + (i.product.fats * i.weightG) / 100,
          0,
        ),
        carbs: meal.items.reduce(
          (sum, i) => sum + (i.product.carbs * i.weightG) / 100,
          0,
        ),
      },
      items: meal.items.map((i) => i.product.name),
    }));

    return {
      profile: {
        gender: user.gender,
        age,
        heightCm: user.heightCm,
        currentWeightKg: user.currentWeight,
        activityLevel: user.activityLevel,
        weightTrend7d: 0, // можно расширить позже через stats
      },
      recentMeals: mealsFormatted,
      reactions: reactions.map((r) => ({
        name: r.name,
        reactionRate: 0, // placeholder — можно улучшить
      })),
      topReactedProducts: reactionStats.map((s) => ({
        product: s.product.name,
        reactionMealsCount: s.reactionMealsCount,
      })),
    };
  }
}
