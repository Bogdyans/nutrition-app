import { IsNotEmpty, IsUUID } from 'class-validator';

export class InviteDto {
  @IsUUID()
  @IsNotEmpty()
  invitedUserId: string;
}
