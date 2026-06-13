import { IsOptional, IsString } from 'class-validator';

export class RecognizeMealDto {
  @IsOptional()
  @IsString({ message: 'Подсказка должна быть строкой' })
  hint?: string;
}
