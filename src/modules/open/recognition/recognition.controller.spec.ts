import { Test, TestingModule } from '@nestjs/testing';
import { MealVisionController } from './recognition.controller';
import { MealVisionService } from './recognition.service';

describe('MealVisionController', () => {
  let controller: MealVisionController;

  const mockService = {
    recognize: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MealVisionController],
      providers: [
        {
          provide: MealVisionService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get(MealVisionController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call service.recognize', async () => {
    mockService.recognize.mockResolvedValue({ items: [] });

    const file = {
      buffer: Buffer.from('test'),
      mimetype: 'image/jpeg',
    } as Express.Multer.File;

    await controller.recognize(file, { hint: 'salad' });

    expect(mockService.recognize).toHaveBeenCalledWith(file, {
      hint: 'salad',
    });
  });
});
