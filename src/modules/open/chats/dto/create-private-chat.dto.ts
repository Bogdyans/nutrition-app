import { IsUUID } from 'class-validator';

export class CreatePrivateChatDto {
  @IsUUID()
  targetUserId: string;
}
