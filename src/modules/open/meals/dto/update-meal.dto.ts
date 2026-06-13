import { IsDateString, IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdateMealDto {
  @IsOptional()
  @IsDateString({}, { message: 'Некорректная дата приёма пищи' })
  timestamp?: string;

  @IsOptional()
  @ValidateIf((object, value) => value !== null)
  @IsString({ message: 'Ссылка на фото должна быть строкой' })
  photoUrl?: string | null;
}
