import {
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Gender, ActivityLevel } from '@prisma/client';

export class UpdateProfileDto {
  @IsOptional()
  @IsEnum(Gender, { message: 'Недопустимое значение пола' })
  gender?: Gender;

  @IsOptional()
  @IsDateString({}, { message: 'Некорректная дата рождения' })
  birthDate?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Рост должен быть числом' })
  @Min(40, { message: 'Рост должен быть не меньше 40 см' })
  @Max(400, { message: 'Рост должен быть не больше 400 см' })
  heightCm?: number;

  @IsOptional()
  @IsEnum(ActivityLevel, { message: 'Недопустимый уровень активности' })
  activityLevel?: ActivityLevel;
}
