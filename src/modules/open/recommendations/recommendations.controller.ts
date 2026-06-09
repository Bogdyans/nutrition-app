import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { UserThrottlerGuard } from '../../../shared/guards/user-throttler.guard';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { SessionUserDataFromJwt } from '../../core/auth/types';
import { RecommendationsService } from './services/recommendations.service';

@UseGuards(JwtAuthGuard, UserThrottlerGuard)
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('generate')
  async generate(@CurrentUser() user: SessionUserDataFromJwt) {
    return this.recommendationsService.generateAndSave(user.id);
  }

  @Get()
  async findLatest(@CurrentUser() user: SessionUserDataFromJwt) {
    return this.recommendationsService.findLatest(user.id);
  }
}
