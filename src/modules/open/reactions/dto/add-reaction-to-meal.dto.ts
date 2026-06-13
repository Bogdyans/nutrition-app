import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SeverityLevel } from '@prisma/client';

class ReactionItemDto {
  @IsUUID(undefined, { message: 'Некорректный идентификатор реакции' })
  reactionId: string;

  @IsOptional()
  @IsEnum(SeverityLevel, { message: 'Недопустимый уровень выраженности' })
  severity?: SeverityLevel;
}

export class AddMealReactionsDto {
  @IsArray({ message: 'Список реакций должен быть массивом' })
  @ArrayMinSize(1, { message: 'Добавьте хотя бы одну реакцию' })
  @ValidateNested({ each: true })
  @Type(() => ReactionItemDto)
  reactions: ReactionItemDto[];
}
