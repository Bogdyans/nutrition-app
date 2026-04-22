import { Module } from '@nestjs/common';
import { MealVisionService } from './recognition.service';
import { MealVisionController } from './recognition.controller';
import { VisionClient } from './infrastructure/vision/vision.client';

@Module({
  controllers: [MealVisionController],
  providers: [MealVisionService, VisionClient],
  exports: [MealVisionService],
})
export class MealVisionModule {}
