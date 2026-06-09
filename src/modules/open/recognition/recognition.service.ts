import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { VisionClient } from './infrastructure/vision/vision.client';
import { VisionParser } from './infrastructure/vision/vision.parser';
import { withRetry } from './infrastructure/vision/vision.retry';
import { normalizeItems } from './domain/normalize';
import {
  parseVisionOutput,
  ParsedVisionOutput,
} from './domain/vision-output.validator';
import {
  collectSearchTerms,
  matchProducts,
} from './domain/product-matcher';
import { RecognitionResult } from './domain/types';
import { RecognizeMealDto } from './dto/recognize.dto';
import { ProductsService } from '../products/products.service';

@Injectable()
export class MealVisionService {
  private readonly logger = new Logger(MealVisionService.name);

  constructor(
    private readonly vision: VisionClient,
    private readonly products: ProductsService,
  ) {}

  async recognize(
    userId: string,
    file: Express.Multer.File,
    dto: RecognizeMealDto,
  ): Promise<RecognitionResult> {
    if (!file?.buffer) {
      throw new BadRequestException('Invalid file');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }

    const base64 = file.buffer.toString('base64');

    let rawText: string;
    try {
      rawText = await withRetry(() =>
        this.vision.recognize({
          imageBase64: base64,
          mimeType: file.mimetype,
          hint: dto.hint,
        }),
      );
    } catch (error) {
      this.logger.error('Vision provider request failed', error as Error);
      throw new ServiceUnavailableException(
        'Сервис распознавания временно недоступен. Попробуйте позже.',
      );
    }

    let parsed: ParsedVisionOutput;
    try {
      parsed = parseVisionOutput(VisionParser.safeParse(rawText));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new UnprocessableEntityException((error as Error).message);
    }

    if (!parsed.items.length) {
      throw new BadRequestException('No food detected');
    }

    const recognizedItems = normalizeItems(parsed.items);

    const candidates = await this.products.findAvailableMatchingTerms(
      userId,
      collectSearchTerms(recognizedItems),
    );

    const { items, unmatched } = matchProducts(recognizedItems, candidates);

    return { items, unmatched, notes: parsed.notes };
  }
}
