import { Injectable, Logger } from '@nestjs/common';
import { RecommendationAiProvider } from './recommendation-ai.provider';
import { OpenRouterService } from '../services/open-router.service';
import { GeminiService } from '../services/gemini.service';

@Injectable()
export class RecommendationAiRouter implements RecommendationAiProvider {
  private readonly logger = new Logger(RecommendationAiRouter.name);

  constructor(
    private readonly openRouter: OpenRouterService,
    private readonly gemini: GeminiService,
  ) {}

  async generateText(prompt: string): Promise<string> {
    try {
      return await this.openRouter.generateText(prompt);
    } catch (groqError) {
      this.logger.warn('Groq/OpenRouter failed, falling back to Gemini');

      try {
        return await this.gemini.generateText(prompt);
      } catch (geminiError) {
        this.logger.error('Both AI providers failed', geminiError as Error);
        throw groqError;
      }
    }
  }
}
