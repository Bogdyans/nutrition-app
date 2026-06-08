import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateReactionDto } from './dto/add-reaction.dto';
import { UpdateReactionDto } from './dto/update-reaction.dto';
import { AddMealReactionsDto } from './dto/add-reaction-to-meal.dto';

// предполагаем, что у тебя есть декоратор userId
import { ReactionsService } from './services/reactions.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { JwtPayload } from '../../core/auth/types';
import { ReactionsCRUDService } from './services/reactions-crud.service';
import { ReactionStatsQueryService } from './services/reaction-stats.query.service';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('reactions')
export class ReactionsController {
  constructor(
    private readonly service: ReactionsService,
    private readonly crudService: ReactionsCRUDService,
    private readonly statsQuery: ReactionStatsQueryService,
  ) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateReactionDto) {
    return this.crudService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.crudService.findAll(user.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateReactionDto,
  ) {
    return this.crudService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.crudService.remove(user.id, id);
  }

  // --- meal reactions ---

  @Post('/meal/:mealId')
  addToMeal(
    @CurrentUser() user: JwtPayload,
    @Param('mealId') mealId: string,
    @Body() dto: AddMealReactionsDto,
  ) {
    return this.service.addToMeal(user.id, mealId, dto);
  }

  @Delete('/meal-reaction/:id')
  removeFromMeal(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.removeFromMeal(user.id, id);
  }

  // --- stats ---

  @Get('/stats/products')
  getProductsStats(@CurrentUser() user: JwtPayload) {
    return this.statsQuery.getProductsStats(user.id);
  }

  @Get('/stats/overview')
  getStatsOverview(@CurrentUser() user: JwtPayload) {
    return this.statsQuery.getOverview(user.id);
  }

  @Get('/stats/reaction/:reactionId')
  getReactionDetails(
    @CurrentUser() user: JwtPayload,
    @Param('reactionId') reactionId: string,
  ) {
    return this.statsQuery.getReactionDetails(user.id, reactionId);
  }

  @Get('/product/:productId/stats')
  getStats(
    @CurrentUser() user: JwtPayload,
    @Param('productId') productId: string,
  ) {
    return this.service.getProductStats(user.id, productId);
  }
}
