import { IsIn, IsUUID } from 'class-validator';
import { GroupRole } from '@prisma/client';

export class UpdateRoleDto {
  @IsUUID()
  userId: string;

  @IsIn([GroupRole.ADMIN, GroupRole.MEMBER])
  role: GroupRole;
}
