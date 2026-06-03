import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { SessionUserDataFromJwt } from '../../core/auth/types';
import { OpenUsersService } from './open-users.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly openUsersService: OpenUsersService) {}

  @Get('find')
  findByUsername(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Query('username') username: string,
  ) {
    return this.openUsersService.findByUsername(username);
  }
}
