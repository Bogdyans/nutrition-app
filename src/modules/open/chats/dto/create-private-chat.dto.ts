import { IsUUID } from 'class-validator';

export class CreatePrivateChatDto {
  @IsUUID(undefined, { message: 'Некорректный идентификатор пользователя' })
  targetUserId: string;
}
