import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);
  private readonly client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not defined in .env');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }

  async generateText(prompt: string): Promise<string> {
    console.log(prompt);

    try {
      const completion = await this.client.chat.completions.create({
        model: 'google/gemma-4-31b-it:free',
        messages: [
          {
            role: 'system',
            content: 'Ты — нутрициолог. Отвечай только на русском.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 1,
        max_completion_tokens: 1024,
        top_p: 1,
        stream: false,
      });

      const text = completion.choices?.[0]?.message?.content;

      if (!text) throw new Error('Empty response from Groq');

      return text.trim();
    } catch (error) {
      this.logger.error('Groq API error', error);
      throw new Error(
        'Не удалось получить рекомендацию от ИИ. Попробуйте позже.',
      );
    }
  }
}
