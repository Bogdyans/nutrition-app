import { IsNumber, IsOptional, IsDateString, Min, Max } from 'class-validator';

export class CreateWeightRecordDto {
  @IsNumber({}, { message: 'Вес должен быть числом' })
  @Min(2, { message: 'Вес должен быть не меньше 2 кг' })
  @Max(700, { message: 'Вес должен быть не больше 700 кг' })
  weightInKg: number;

  @IsOptional()
  @IsDateString({}, { message: 'Некорректная дата измерения' })
  measuredAt?: string;
}
