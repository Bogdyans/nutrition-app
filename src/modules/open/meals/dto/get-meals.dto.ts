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
  @IsDateString()
  date?: string;

  @ValidateIf((o: GetMealsDto) => !o.date)
  @IsOptional()
  @IsDateString()
  from?: string;

  @ValidateIf((o: GetMealsDto) => !o.date)
  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
