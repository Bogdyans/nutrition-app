import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SearchMessagesDto {
  @IsString({ message: 'Поисковый запрос должен быть строкой' })
  @IsNotEmpty({ message: 'Введите поисковый запрос' })
  @MinLength(1, { message: 'Введите поисковый запрос' })
  @MaxLength(100, { message: 'Поисковый запрос не должен превышать 100 символов' })
  q: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Количество должно быть целым числом' })
  @Min(1, { message: 'Количество должно быть не меньше 1' })
  @Max(100, { message: 'Количество должно быть не больше 100' })
  take?: number = 20;

  @IsOptional()
  @IsString({ message: 'Курсор должен быть строкой' })
  cursor?: string;
}
