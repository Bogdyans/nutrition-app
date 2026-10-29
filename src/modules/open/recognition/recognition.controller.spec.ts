import { Test, TestingModule } from '@nestjs/testing';
import { MealVisionController } from './recognition.controller';
import { MealVisionService } from './recognition.service';
import { UserThrottlerGuard } from '../../../shared/guards/user-throttler.guard';
import type { SessionUserDataFromJwt } from '../../core/auth/types';

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
    })
      .overrideGuard(UserThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(MealVisionController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call service.recognize', async () => {
    mockService.recognize.mockResolvedValue({ items: [], unmatched: [] });

    const file = {
      buffer: Buffer.from('test'),
      mimetype: 'image/jpeg',
    } as Express.Multer.File;

    const user: SessionUserDataFromJwt = {
      id: 'user-1',
      email: 'user@example.com',
      roles: [],
    };

    await controller.recognize(user, file, { hint: 'salad' });

    expect(mockService.recognize).toHaveBeenCalledWith('user-1', file, {
      hint: 'salad',
    });
  });
});
