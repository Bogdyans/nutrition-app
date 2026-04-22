import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { SessionUserDataFromJwt } from '../../core/auth/types';
import { RecommendationsService } from './services/recommendations.service';

@UseGuards(JwtAuthGuard)
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Post('generate')
  async generate(@CurrentUser() user: SessionUserDataFromJwt) {
    return this.recommendationsService.generateAndSave(user.id);
  }

  @Get()
  async findLatest(@CurrentUser() user: SessionUserDataFromJwt) {
    return this.recommendationsService.findLatest(user.id);
  }
}
