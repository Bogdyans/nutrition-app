import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

// Границы суток считаются в таймзоне пользователя, поэтому здесь нужен
// именно календарный день без времени: полный ISO-timestamp сделал бы
// «начало дня» бессмысленным.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class GetMealsDto {
  @ValidateIf((o: GetMealsDto) => !o.from && !o.to)
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'Используйте формат даты ГГГГ-ММ-ДД' })
  date?: string;

  @ValidateIf((o: GetMealsDto) => !o.date)
  @IsOptional()
  @Matches(DATE_ONLY, {
    message: 'Используйте формат начальной даты ГГГГ-ММ-ДД',
  })
  from?: string;

  @ValidateIf((o: GetMealsDto) => !o.date)
  @IsOptional()
  @Matches(DATE_ONLY, {
    message: 'Используйте формат конечной даты ГГГГ-ММ-ДД',
  })
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
