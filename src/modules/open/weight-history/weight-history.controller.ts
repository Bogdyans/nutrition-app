import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { WeightHistoryService } from './weight-history.service';
import { CreateWeightRecordDto } from './dto/create-weight-record.dto';
import { UpdateWeightRecordDto } from './dto/update-weight-record.dto';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { SessionUserDataFromJwt } from '../../core/auth/types';

@UseGuards(JwtAuthGuard)
@Controller('weight-history')
export class WeightHistoryController {
  constructor(private readonly weightHistoryService: WeightHistoryService) {}

  @Post()
  create(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Body() dto: CreateWeightRecordDto,
  ) {
    return this.weightHistoryService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: SessionUserDataFromJwt) {
    return this.weightHistoryService.findAll(user.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('id') id: string,
    @Body() dto: UpdateWeightRecordDto,
  ) {
    return this.weightHistoryService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: SessionUserDataFromJwt, @Param('id') id: string) {
    return this.weightHistoryService.remove(user.id, id);
  }
}
