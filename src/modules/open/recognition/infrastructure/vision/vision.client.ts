import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { buildPrompt } from './vision.prompt';
import { RecognizeInput } from '../../domain/types';
import { visionSchema } from '../../dto/vision-output.schema';

@Injectable()
export class VisionClient {
  private client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  async recognize(input: RecognizeInput) {
    const prompt = buildPrompt(input);

    const response = await this.client.responses.create({
      model: 'gpt-4.1-mini',
      instructions: 'Return ONLY valid JSON that matches the provided schema.',
      input: [prompt],
      text: {
        format: {
          type: 'json_schema',
          name: 'meal_recognition',
          schema: visionSchema,
        },
      },
    });
    return response;
  }
}
