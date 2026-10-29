import { Test, TestingModule } from '@nestjs/testing';
import { MealVisionService } from './recognition.service';
import { VisionClient } from './infrastructure/vision/vision.client';
import { ProductsService } from '../products/products.service';
import { BadRequestException } from '@nestjs/common';

describe('MealVisionService', () => {
  let service: MealVisionService;

  const mockVisionClient = {
    recognize: jest.fn(),
  };

  const mockProductsService = {
    findAvailableMatchingTerms: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealVisionService,
        { provide: VisionClient, useValue: mockVisionClient },
        { provide: ProductsService, useValue: mockProductsService },
      ],
    }).compile();

    service = module.get(MealVisionService);
    mockProductsService.findAvailableMatchingTerms.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const validFile = {
    buffer: Buffer.from('test'),
    mimetype: 'image/jpeg',
  } as Express.Multer.File;

  type MatchableProduct = Awaited<
    ReturnType<ProductsService['findAvailableMatchingTerms']>
  >[number];

  const product = (id: string, name: string): MatchableProduct =>
    ({
      id,
      name,
      calories: 89,
      proteins: 1,
      fats: 0,
      carbs: 23,
    }) as MatchableProduct;

  it('groups a recognized food with its matching products', async () => {
    mockVisionClient.recognize.mockResolvedValue(
      JSON.stringify({
        items: [{ name: ' Banana ', grams: 99.999, confidence: 0.12345 }],
      }),
    );
    const banana = product('p1', 'Banana');
    mockProductsService.findAvailableMatchingTerms.mockResolvedValue([banana]);

    const result = await service.recognize('user-1', validFile, {});

    expect(result.items).toEqual([
      {
        recognized: { name: 'Banana', grams: 100.0, confidence: 0.12 },
        matches: [banana],
      },
    ]);
    expect(result.unmatched).toEqual([]);
  });

  it('returns foods with no DB match as unmatched', async () => {
    mockVisionClient.recognize.mockResolvedValue(
      JSON.stringify({
        items: [{ name: 'Rice', grams: 100, confidence: 0.9 }],
      }),
    );
    mockProductsService.findAvailableMatchingTerms.mockResolvedValue([]);

    const result = await service.recognize('user-1', validFile, {});

    expect(result.items).toEqual([]);
    expect(result.unmatched).toEqual([
      { name: 'Rice', grams: 100, confidence: 0.9 },
    ]);
  });

  it('passes notes through', async () => {
    mockVisionClient.recognize.mockResolvedValue(
      JSON.stringify({
        items: [{ name: 'Rice', grams: 100, confidence: 0.9 }],
        notes: ['uncertain portion'],
      }),
    );

    const result = await service.recognize('user-1', validFile, {});

    expect(result.notes).toEqual(['uncertain portion']);
  });

  it('should throw if file is missing', async () => {
    await expect(
      service.recognize('user-1', null as unknown as Express.Multer.File, {}),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject non-image file', async () => {
    const file = {
      buffer: Buffer.from('test'),
      mimetype: 'application/pdf',
    } as Express.Multer.File;

    await expect(service.recognize('user-1', file, {})).rejects.toThrow(
      'Допускаются только изображения',
    );
  });

  it('should throw if no items detected', async () => {
    mockVisionClient.recognize.mockResolvedValue(JSON.stringify({ items: [] }));

    await expect(service.recognize('user-1', validFile, {})).rejects.toThrow(
      'Еда на фото не обнаружена',
    );
  });

  it('should throw on invalid JSON from model', async () => {
    mockVisionClient.recognize.mockResolvedValue('invalid json');

    await expect(service.recognize('user-1', validFile, {})).rejects.toThrow(
      'Не удалось распознать блюдо на фотографии',
    );
  });
});
