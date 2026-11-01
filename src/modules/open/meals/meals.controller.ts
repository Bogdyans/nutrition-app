import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { SessionUserDataFromJwt } from '../../core/auth/types';
import { MealsService } from './meals.service';
import { CreateMealDto } from './dto/create-meal.dto';
import { AddMealItemDto } from './dto/add-meal-item.dto';
import { GetMealsDto } from './dto/get-meals.dto';
import { UpdateMealDto } from './dto/update-meal.dto';
import { UpdateMealItemDto } from './dto/update-meal-item.dto';
import { TimezoneOffset } from '../../../shared/decorators/timezone-offset.decorator';
import type { TimezoneOffsetMinutes } from '../../../shared/utils/date';

@UseGuards(JwtAuthGuard)
@Controller('meals')
export class MealsController {
  constructor(private readonly mealsService: MealsService) {}

  @Post()
  create(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Body() dto: CreateMealDto,
  ) {
    return this.mealsService.create(user.id, dto);
  }

  @Get()
  findMany(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Query() query: GetMealsDto,
    @TimezoneOffset() timezoneOffset: TimezoneOffsetMinutes,
  ) {
    return this.mealsService.findMany(user.id, query, timezoneOffset);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('id') mealId: string,
  ) {
    return this.mealsService.findOne(user.id, mealId);
  }

  @Post(':id/items')
  addItem(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('id') mealId: string,
    @Body() dto: AddMealItemDto,
  ) {
    return this.mealsService.addItem(user.id, mealId, dto);
  }

  @Delete(':mealId/items/:itemId')
  removeItem(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('mealId') mealId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.mealsService.removeItem(user.id, mealId, itemId);
  }

  @Patch(':id')
  updateMeal(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('id') mealId: string,
    @Body() dto: UpdateMealDto,
  ) {
    return this.mealsService.updateMeal(user.id, mealId, dto);
  }

  @Patch(':mealId/items/:itemId')
  updateItem(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('mealId') mealId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateMealItemDto,
  ) {
    return this.mealsService.updateItem(user.id, mealId, itemId, dto);
  }

  @Delete(':id')
  deleteMeal(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('id') mealId: string,
  ) {
    return this.mealsService.deleteMeal(user.id, mealId);
  }
}
