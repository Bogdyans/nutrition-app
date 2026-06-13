import { IsIn, IsUUID } from 'class-validator';
import { GroupRole } from '@prisma/client';

export class UpdateRoleDto {
  @IsUUID(undefined, { message: 'Некорректный идентификатор пользователя' })
  userId: string;

  @IsIn([GroupRole.ADMIN, GroupRole.MEMBER], { message: 'Недопустимая роль' })
  role: GroupRole;
}
