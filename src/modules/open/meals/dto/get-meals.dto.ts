import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class GetMealsDto {
  @ValidateIf((o: GetMealsDto) => !o.from && !o.to)
  @IsOptional()
  @IsDateString({}, { message: 'Некорректная дата' })
  date?: string;

  @ValidateIf((o: GetMealsDto) => !o.date)
  @IsOptional()
  @IsDateString({}, { message: 'Некорректная начальная дата' })
  from?: string;

  @ValidateIf((o: GetMealsDto) => !o.date)
  @IsOptional()
  @IsDateString({}, { message: 'Некорректная конечная дата' })
  to?: string;

  @IsOptional()
  @IsString({ message: 'Курсор должен быть строкой' })
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Лимит должен быть целым числом' })
  @Min(1, { message: 'Лимит должен быть не меньше 1' })
  @Max(20, { message: 'Лимит должен быть не больше 20' })
  limit?: number;
}
