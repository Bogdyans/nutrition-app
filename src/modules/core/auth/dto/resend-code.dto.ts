import { IsEmail } from 'class-validator';

export class ResendCodeDto {
  @IsEmail({}, { message: 'Некорректный адрес электронной почты' })
  email: string;
}
