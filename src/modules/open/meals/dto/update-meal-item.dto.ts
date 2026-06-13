import { IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMealItemDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'Масса порции должна быть числом' })
  @Min(1, { message: 'Масса порции должна быть не меньше 1 грамма' })
  weightG: number;
}
