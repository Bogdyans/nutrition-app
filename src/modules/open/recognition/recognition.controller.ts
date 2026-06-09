import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { UserThrottlerGuard } from '../../../shared/guards/user-throttler.guard';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { SessionUserDataFromJwt } from '../../core/auth/types';
import { RecognizeMealDto } from './dto/recognize.dto';
import { MealVisionService } from './recognition.service';

@UseGuards(JwtAuthGuard, UserThrottlerGuard)
@Controller('meal-vision')
export class MealVisionController {
  constructor(private readonly service: MealVisionService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('recognize')
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async recognize(
    @CurrentUser() user: SessionUserDataFromJwt,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: RecognizeMealDto,
  ) {
    console.log('controller');
    return this.service.recognize(user.id, file, dto);
  }
}
