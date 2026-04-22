import { BadRequestException, Injectable } from '@nestjs/common';
import { VisionClient } from './infrastructure/vision/vision.client';
import { VisionParser } from './infrastructure/vision/vision.parser';
import { withRetry } from './infrastructure/vision/vision.retry';
import { normalizeItems } from './domain/normalize';
import { RecognizeMealResult } from './domain/types';
import { RecognizeMealDto } from './dto/recognize.dto';

@Injectable()
export class MealVisionService {
  constructor(private readonly vision: VisionClient) {}

  async recognize(
    file: Express.Multer.File,
    dto: RecognizeMealDto,
  ): Promise<RecognizeMealResult> {
    if (!file?.buffer) {
      throw new BadRequestException('Invalid file');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }

    const base64 = file.buffer.toString('base64');

    const response = await withRetry(() =>
      this.vision.recognize({
        imageBase64: base64,
        mimeType: file.mimetype,
        hint: dto.hint,
      }),
    );

    const raw = VisionParser.safeParse(response.output_text) as {
      items: {
        name: string;
        grams: number;
        confidence: number;
      }[];
      notes?: string[];
    };

    if (!raw?.items?.length) {
      throw new BadRequestException('No food detected');
    }

    return {
      items: normalizeItems(raw.items),
      notes: raw.notes,
    };
  }
}
