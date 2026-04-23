import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { buildPrompt } from './vision.prompt';
import { RecognizeInput } from '../../domain/types';
import { visionSchema } from '../../dto/vision-output.schema';

@Injectable()
export class VisionClient {
  private client = new OpenAI({
    apiKey: process.env.VISION_OPENROUTER_API_KEY,
    baseURL: process.env.VISION_OPENROUTER_API_URL,
    defaultHeaders: {
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'perekusov-net',
    },
  });

  async recognize(input: RecognizeInput) {
    const prompt = buildPrompt(input);

    const response = await this.client.responses.create({
      model: 'google/gemma-4-31b-it:free',
      instructions:
        'Return ONLY valid JSON that matches the provided schema. the array of items SHOUD BE NAMED "items". Each item has "name" (In Russian), "grams"  and "confidence" (0 to 1, how much you confident in your answer)',
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
