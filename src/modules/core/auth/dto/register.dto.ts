import {
  Equals,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Некорректный адрес электронной почты' })
  email: string;

  @IsString({ message: 'Пароль должен быть строкой' })
  @IsNotEmpty({ message: 'Введите пароль' })
  @MinLength(8, { message: 'Пароль должен содержать минимум 8 символов' })
  password: string;

  @IsNotEmpty({ message: 'Введите имя пользователя' })
  @IsString({ message: 'Имя пользователя должно быть строкой' })
  @MinLength(5, {
    message: 'Имя пользователя должно содержать минимум 5 символов',
  })
  username: string;

  @IsBoolean({ message: 'Некорректное значение согласия' })
  @Equals(true, {
    message: 'Необходимо принять политику конфиденциальности',
  })
  acceptedPrivacy: boolean;
}
