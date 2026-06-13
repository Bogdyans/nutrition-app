import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class WeightHistoryPaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Количество должно быть целым числом' })
  @Min(1, { message: 'Количество должно быть не меньше 1' })
  @Max(100, { message: 'Количество должно быть не больше 100' })
  take: number = 30;

  @IsOptional()
  @IsString({ message: 'Курсор должен быть строкой' })
  cursor?: string;
}
