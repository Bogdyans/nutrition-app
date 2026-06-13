import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GetMessagesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Количество должно быть целым числом' })
  @Min(1, { message: 'Количество должно быть не меньше 1' })
  @Max(100, { message: 'Количество должно быть не больше 100' })
  take?: number = 20;

  @IsOptional()
  @IsString({ message: 'Курсор должен быть строкой' })
  cursor?: string;
}
