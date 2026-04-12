import { IsString, IsOptional, IsNumber, Min, IsEnum } from 'class-validator';
import { ProductVisibility } from '@prisma/client';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  calories?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  proteins?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fats?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  carbs?: number;

  @IsOptional()
  @IsEnum(ProductVisibility)
  visibility?: ProductVisibility;
}
