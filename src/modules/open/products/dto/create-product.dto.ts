import { IsString, IsOptional, IsNumber, Min, IsEnum } from 'class-validator';
import { ProductVisibility } from '@prisma/client';

export class CreateProductDto {
  @IsString({ message: 'Название должно быть строкой' })
  name: string;

  @IsOptional()
  @IsNumber({}, { message: 'Калорийность должна быть числом' })
  @Min(0, { message: 'Калорийность не может быть отрицательной' })
  calories?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Белки должны быть числом' })
  @Min(0, { message: 'Белки не могут быть отрицательными' })
  proteins?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Жиры должны быть числом' })
  @Min(0, { message: 'Жиры не могут быть отрицательными' })
  fats?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Углеводы должны быть числом' })
  @Min(0, { message: 'Углеводы не могут быть отрицательными' })
  carbs?: number;

  @IsOptional()
  @IsEnum(ProductVisibility, { message: 'Недопустимое значение видимости' })
  visibility?: ProductVisibility;
}
