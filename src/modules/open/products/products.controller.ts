import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { GetProductsDto } from './dto/get-products.dto';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { SessionUserDataFromJwt } from '../../core/auth/types';
import { UpdateVisibilityDto } from './dto/update-visibility.dto';

@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.create(user.id, dto);
  }

  @Get()
  findAvailable(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Query() query: GetProductsDto,
  ) {
    return this.productsService.findAvailableForUser(user.id, query);
  }

  @Patch(':id/visibility')
  updateVisibility(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('id') productId: string,
    @Body() dto: UpdateVisibilityDto,
  ) {
    return this.productsService.updateVisibility(
      user.id,
      productId,
      dto.visibility,
    );
  }

  @Delete(':id')
  delete(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('id') productId: string,
  ) {
    return this.productsService.delete(user.id, productId);
  }
}
