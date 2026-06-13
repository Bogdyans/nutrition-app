import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AddMealItemDto } from './add-meal-item.dto';

export class CreateMealDto {
  @IsOptional()
  @IsDateString({}, { message: 'Некорректная дата приёма пищи' })
  timestamp?: string;

  @IsOptional()
  @IsString({ message: 'Ссылка на фото должна быть строкой' })
  photoUrl?: string;

  @IsArray({ message: 'Список продуктов должен быть массивом' })
  @ArrayMinSize(1, { message: 'Добавьте хотя бы один продукт' })
  @ValidateNested({ each: true })
  @Type(() => AddMealItemDto)
  items: AddMealItemDto[];
}
