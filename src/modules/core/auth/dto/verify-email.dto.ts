import { IsEmail, IsString, Matches } from 'class-validator';

export class VerifyEmailDto {
  @IsEmail({}, { message: 'Некорректный адрес электронной почты' })
  email: string;

  @IsString({ message: 'Код должен быть строкой' })
  @Matches(/^\d{6}$/, { message: 'Код должен состоять из 6 цифр' })
  code: string;
}
