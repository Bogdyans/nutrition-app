import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateGroupDto {
  @IsString({ message: 'Название должно быть строкой' })
  @IsNotEmpty({ message: 'Введите название группы' })
  @MinLength(2, { message: 'Название должно содержать минимум 2 символа' })
  @MaxLength(100, { message: 'Название не должно превышать 100 символов' })
  name: string;
}
