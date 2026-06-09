import { Inject, Injectable, Logger } from '@nestjs/common';
import { RecommendationPromptBuilder } from '../domain/recommendation-prompt.builder';

import { RecommendationsRepository } from '../infrastructure/recommendations.repository';
import {
  RECOMMENDATION_AI_PROVIDER,
  type RecommendationAiProvider,
} from '../domain/recommendation-ai.provider';
import { RecommendationContextBuilder } from '../domain/recommendation-context.builder';

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    private readonly contextBuilder: RecommendationContextBuilder,
    private readonly promptBuilder: RecommendationPromptBuilder,
    private readonly recommendationsRepository: RecommendationsRepository,
    @Inject(RECOMMENDATION_AI_PROVIDER)
    private readonly ai: RecommendationAiProvider,
  ) {}

  async generateAndSave(userId: string) {
    const context = await this.contextBuilder.build(userId);
    const prompt = this.promptBuilder.build(context);

    this.logger.log(`Генерация рекомендации для пользователя ${userId}`);
    const content = await this.ai.generateText(prompt);

    const recommendation = await this.recommendationsRepository.create(
      userId,
      content,
    );

    return {
      id: recommendation.id,
      createdAt: recommendation.createdAt,
      content,
    };
  }

  async findLatest(userId: string) {
    return this.recommendationsRepository.findLatest(userId);
  }
}
