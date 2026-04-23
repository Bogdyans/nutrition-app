import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { RecommendationsController } from './recommendations.controller';
import { GeminiService } from './services/gemini.service';
import { RecommendationsService } from './services/recommendations.service';
import { RecommendationPromptBuilder } from './domain/recommendation-prompt.builder';
import { RecommendationsRepository } from './infrastructure/recommendations.repository';
import { RecommendationContextBuilder } from './domain/recommendation-context.builder';
import { RecommendationAiRouter } from './domain/recommendation-ai.router';
import { OpenRouterService } from './services/open-router.service';
import { RECOMMENDATION_AI_PROVIDER } from './domain/recommendation-ai.provider';

@Module({
  imports: [PrismaModule],
  controllers: [RecommendationsController],
  providers: [
    RecommendationsService,
    RecommendationContextBuilder,
    RecommendationPromptBuilder,
    RecommendationsRepository,
    OpenRouterService,
    GeminiService,
    RecommendationAiRouter,
    {
      provide: RECOMMENDATION_AI_PROVIDER,
      useExisting: RecommendationAiRouter,
    },
  ],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
