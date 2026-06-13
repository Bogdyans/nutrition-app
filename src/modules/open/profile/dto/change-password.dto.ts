import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString({ message: 'Текущий пароль должен быть строкой' })
  @IsNotEmpty({ message: 'Введите текущий пароль' })
  oldPassword: string;

  @IsString({ message: 'Новый пароль должен быть строкой' })
  @IsNotEmpty({ message: 'Введите новый пароль' })
  @MinLength(8, { message: 'Новый пароль должен содержать минимум 8 символов' })
  newPassword: string;
}
