import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetProductsDto {
  @IsOptional()
  @IsString({ message: 'Поисковый запрос должен быть строкой' })
  query?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Лимит должен быть целым числом' })
  @Min(1, { message: 'Лимит должен быть не меньше 1' })
  @Max(30, { message: 'Лимит должен быть не больше 30' })
  limit?: number = 20;

  @IsOptional()
  @IsString({ message: 'Курсор должен быть строкой' })
  cursor?: string;
}
