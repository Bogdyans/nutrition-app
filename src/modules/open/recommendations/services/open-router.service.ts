import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import OpenAI from 'openai';
import { RecommendationAiProvider } from '../domain/recommendation-ai.provider';

@Injectable()
export class OpenRouterService implements RecommendationAiProvider {
  private readonly logger = new Logger(OpenRouterService.name);
  private readonly client: OpenAI;

  constructor() {
    const apiKey = process.env.RECOMMENDATION_OPENROUTER_API_KEY;
    const apiUrl = process.env.RECOMMENDATION_OPENROUTER_API_URL;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not defined in .env');
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: apiUrl,
      timeout: 60000,
    });
  }

  async generateText(prompt: string): Promise<string> {
    const model = process.env.RECOMMENDATION_OPENROUTER_MODEL;
    if (!model) throw new Error('OPENROUTER_MODEL not defined in .env');
    try {
      const completion = await this.client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'Ты — нутрициолог. Отвечай только на русском.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.5,
        max_completion_tokens: 2000,
        top_p: 1,
        stream: false,
      });
      const text = completion.choices?.[0]?.message?.content;
      if (!text) throw new Error('Empty response from Groq/OpenRouter');
      return text.trim();
    } catch (error) {
      this.logger.error('OpenRouter API error', error as Error);
      throw new ServiceUnavailableException(
        'Не удалось получить рекомендацию от ИИ. Попробуйте позже.',
      );
    }
  }
}
