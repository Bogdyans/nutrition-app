import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Некорректный адрес электронной почты' })
  email: string;

  @IsString({ message: 'Пароль должен быть строкой' })
  password: string;
}
