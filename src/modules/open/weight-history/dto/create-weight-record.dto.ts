import { IsNumber, IsOptional, IsDateString, Min, Max } from 'class-validator';

export class CreateWeightRecordDto {
  @IsNumber()
  @Min(2)
  @Max(700)
  weightInKg: number;

  @IsOptional()
  @IsDateString()
  measuredAt?: string;
}
