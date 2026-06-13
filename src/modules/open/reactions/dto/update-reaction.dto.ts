import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateReactionDto {
  @IsOptional()
  @IsString({ message: 'Название должно быть строкой' })
  @MinLength(1, { message: 'Введите название реакции' })
  @MaxLength(100, { message: 'Название не должно превышать 100 символов' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Описание должно быть строкой' })
  @MaxLength(500, { message: 'Описание не должно превышать 500 символов' })
  description?: string;
}
