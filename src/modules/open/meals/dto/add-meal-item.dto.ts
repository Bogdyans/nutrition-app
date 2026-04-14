import { IsNumber, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddMealItemDto {
  @IsUUID()
  productId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  weightG: number;
}
