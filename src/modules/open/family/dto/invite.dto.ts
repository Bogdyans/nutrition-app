import { IsNotEmpty, IsUUID } from 'class-validator';

export class InviteDto {
  @IsUUID(undefined, { message: 'Некорректный идентификатор пользователя' })
  @IsNotEmpty({ message: 'Укажите пользователя' })
  invitedUserId: string;
}
