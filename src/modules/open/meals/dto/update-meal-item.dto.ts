import { IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMealItemDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  weightG: number;
}
