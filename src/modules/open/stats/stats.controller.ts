import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { TimezoneOffset } from '../../../shared/decorators/timezone-offset.decorator';
import type { TimezoneOffsetMinutes } from '../../../shared/utils/date';
import type { SessionUserDataFromJwt } from '../../core/auth/types';
import { StatsService } from './stats.service';
import { GetStatsDayDto } from './dto/get-stats-date.dto';
import { GetStatsRangeDto } from './dto/get-stats-range.dto';

@UseGuards(JwtAuthGuard)
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('day')
  getDay(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Query() query: GetStatsDayDto,
    @TimezoneOffset() timezoneOffset: TimezoneOffsetMinutes,
  ) {
    return this.statsService.getDayStats(user.id, query, timezoneOffset);
  }

  @Get('range')
  getRange(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Query() query: GetStatsRangeDto,
    @TimezoneOffset() timezoneOffset: TimezoneOffsetMinutes,
  ) {
    return this.statsService.getRangeStats(user.id, query, timezoneOffset);
  }

  @Get('weight')
  getWeight(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Query() query: GetStatsRangeDto,
    @TimezoneOffset() timezoneOffset: TimezoneOffsetMinutes,
  ) {
    return this.statsService.getWeightStats(user.id, query, timezoneOffset);
  }

  @Get('summary')
  getSummary(
    @CurrentUser() user: SessionUserDataFromJwt,
    @TimezoneOffset() timezoneOffset: TimezoneOffsetMinutes,
  ) {
    return this.statsService.getSummary(user.id, timezoneOffset);
  }
}
