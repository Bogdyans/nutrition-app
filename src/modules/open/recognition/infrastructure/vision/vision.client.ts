import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { buildUserMessage } from './vision.prompt';
import { RecognizeInput } from '../../domain/types';
import { visionSchema } from '../../dto/vision-output.schema';

const SYSTEM_INSTRUCTION =
  'Return ONLY valid JSON that matches the provided schema. ' +
  'The array of items MUST be named "items". Each item has "name" (in Russian), ' +
  '"grams", and "confidence" (0 to 1 — how confident you are in your answer).';

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

  async recognize(input: RecognizeInput): Promise<string> {
    const model = process.env.VISION_OPENROUTER_MODEL;
    if (!model) {
      throw new Error('VISION_OPENROUTER_MODEL is not defined in .env');
    }

    const completion = await this.client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        buildUserMessage(input),
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'meal_recognition',
          schema: visionSchema as unknown as Record<string, unknown>,
        },
      },
      temperature: 0.2,
    });

    const text = completion.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('Empty response from vision model');
    }

    return text;
  }
}
