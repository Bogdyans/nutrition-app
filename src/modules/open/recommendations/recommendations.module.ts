import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { RecommendationsController } from './recommendations.controller';
import { GeminiService } from './services/gemini.service';
import { RecommendationsService } from './services/recommendations.service';
import { GroqService } from './services/groq.service';

@Module({
  imports: [PrismaModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService, GeminiService, GroqService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
