import { IsString, MinLength, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString({ message: 'Сообщение должно быть строкой' })
  @MinLength(1, { message: 'Сообщение не может быть пустым' })
  @MaxLength(4000, { message: 'Сообщение не должно превышать 4000 символов' })
  content: string;
}
