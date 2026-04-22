import { Test, TestingModule } from '@nestjs/testing';
import { MealVisionService } from './recognition.service';
import { VisionClient } from './infrastructure/vision/vision.client';
import { BadRequestException } from '@nestjs/common';

describe('MealVisionService', () => {
  let service: MealVisionService;

  const mockVisionClient = {
    recognize: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealVisionService,
        {
          provide: VisionClient,
          useValue: mockVisionClient,
        },
      ],
    }).compile();

    service = module.get(MealVisionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const validFile = {
    buffer: Buffer.from('test'),
    mimetype: 'image/jpeg',
  } as Express.Multer.File;

  it('should process and normalize items', async () => {
    mockVisionClient.recognize.mockResolvedValue({
      output_text: JSON.stringify({
        items: [
          {
            name: ' Banana ',
            grams: 99.999,
            confidence: 0.12345,
          },
        ],
      }),
    });

    const result = await service.recognize(validFile, {});

    expect(result).toEqual({
      items: [
        {
          name: 'Banana',
          grams: 100.0,
          confidence: 0.12,
        },
      ],
      notes: undefined,
    });
  });

  it('should include notes if present', async () => {
    mockVisionClient.recognize.mockResolvedValue({
      output_text: JSON.stringify({
        items: [{ name: 'Rice', grams: 100, confidence: 0.9 }],
        notes: ['uncertain portion'],
      }),
    });

    const result = await service.recognize(validFile, {});

    expect(result.notes).toEqual(['uncertain portion']);
  });

  it('should throw if file is missing', async () => {
    await expect(service.recognize(null as any, {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject non-image file', async () => {
    const file = {
      buffer: Buffer.from('test'),
      mimetype: 'application/pdf',
    } as Express.Multer.File;

    await expect(service.recognize(file, {})).rejects.toThrow(
      'Only image files are allowed',
    );
  });

  it('should throw if no items detected', async () => {
    mockVisionClient.recognize.mockResolvedValue({
      output_text: JSON.stringify({ items: [] }),
    });

    await expect(service.recognize(validFile, {})).rejects.toThrow(
      'No food detected',
    );
  });

  it('should throw on invalid JSON from model', async () => {
    mockVisionClient.recognize.mockResolvedValue({
      output_text: 'invalid json',
    });

    await expect(service.recognize(validFile, {})).rejects.toThrow(
      'Invalid JSON from model',
    );
  });
});
