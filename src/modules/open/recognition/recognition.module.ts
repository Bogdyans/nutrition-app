import { Module } from '@nestjs/common';
import { MealVisionService } from './recognition.service';
import { MealVisionController } from './recognition.controller';
import { VisionClient } from './infrastructure/vision/vision.client';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [ProductsModule],
  controllers: [MealVisionController],
  providers: [MealVisionService, VisionClient],
  exports: [MealVisionService],
})
export class MealVisionModule {}
