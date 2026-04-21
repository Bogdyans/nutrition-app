import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { FamilyService } from './family.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { InviteDto } from './dto/invite.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { SessionUserDataFromJwt } from '../../core/auth/types';

@UseGuards(JwtAuthGuard)
@Controller('family')
export class FamilyController {
  constructor(private service: FamilyService) {}

  @Post()
  create(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Body() dto: CreateGroupDto,
  ) {
    return this.service.createGroup(user.id, dto);
  }

  @Get('me')
  getMy(@CurrentUser() user: SessionUserDataFromJwt) {
    return this.service.getMyGroup(user.id);
  }

  @Post('invite')
  invite(@CurrentUser() user: SessionUserDataFromJwt, @Body() dto: InviteDto) {
    return this.service.createInvitation(user.id, dto);
  }

  @Post('accept/:token')
  accept(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('token') token: string,
  ) {
    return this.service.acceptInvitation(user.id, token);
  }

  @Delete('leave')
  leave(@CurrentUser() user: SessionUserDataFromJwt) {
    return this.service.leaveGroup(user.id);
  }

  @Delete('member/:userId')
  remove(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('userId') userId: string,
  ) {
    return this.service.removeMember(user.id, userId);
  }

  @Patch('role')
  updateRole(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.service.updateRole(user.id, dto);
  }

  @Patch('transfer/:userId')
  transfer(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('userId') userId: string,
  ) {
    return this.service.transferOwnership(user.id, userId);
  }
}
