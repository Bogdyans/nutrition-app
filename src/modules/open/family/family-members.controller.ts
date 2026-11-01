import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { TimezoneOffset } from '../../../shared/decorators/timezone-offset.decorator';
import type { TimezoneOffsetMinutes } from '../../../shared/utils/date';
import type { SessionUserDataFromJwt } from '../../core/auth/types';
import { FamilyService } from './family.service';
import { StatsService } from '../stats/stats.service';
import { ReactionStatsQueryService } from '../reactions/services/reaction-stats.query.service';
import { GetStatsRangeDto } from '../stats/dto/get-stats-range.dto';
import { GetStatsDayDto } from '../stats/dto/get-stats-date.dto';

/**
 * Read-only access to a family member's stats and meals. Every endpoint first
 * verifies (via FamilyService) that the requester shares a group with the
 * target user, then reuses the existing Stats / Reactions services.
 */
@UseGuards(JwtAuthGuard)
@Controller('family/members')
export class FamilyMembersController {
  constructor(
    private readonly family: FamilyService,
    private readonly stats: StatsService,
    private readonly reactionStats: ReactionStatsQueryService,
  ) {}

  @Get(':memberId/stats/range')
  async range(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('memberId') memberId: string,
    @Query() query: GetStatsRangeDto,
    @TimezoneOffset() timezoneOffset: TimezoneOffsetMinutes,
  ) {
    await this.family.assertCanViewMember(user.id, memberId);
    return this.stats.getRangeStats(memberId, query, timezoneOffset);
  }

  @Get(':memberId/stats/weight')
  async weight(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('memberId') memberId: string,
    @Query() query: GetStatsRangeDto,
    @TimezoneOffset() timezoneOffset: TimezoneOffsetMinutes,
  ) {
    await this.family.assertCanViewMember(user.id, memberId);
    return this.stats.getWeightStats(memberId, query, timezoneOffset);
  }

  @Get(':memberId/stats/day')
  async day(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('memberId') memberId: string,
    @Query() query: GetStatsDayDto,
    @TimezoneOffset() timezoneOffset: TimezoneOffsetMinutes,
  ) {
    await this.family.assertCanViewMember(user.id, memberId);
    return this.stats.getDayStats(memberId, query, timezoneOffset);
  }

  @Get(':memberId/reactions/products')
  async reactionProducts(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('memberId') memberId: string,
  ) {
    await this.family.assertCanViewMember(user.id, memberId);
    return this.reactionStats.getProductsStats(memberId);
  }
}
