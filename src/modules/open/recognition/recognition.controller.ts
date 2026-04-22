import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RecognizeMealDto } from './dto/recognize.dto';
import { MealVisionService } from './recognition.service';

@UseGuards(JwtAuthGuard)
@Controller('meal-vision')
export class MealVisionController {
  constructor(private readonly service: MealVisionService) {}

  @Post('recognize')
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async recognize(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: RecognizeMealDto,
  ) {
    return this.service.recognize(file, dto);
  }
}
