import {
  IsArray,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SeverityLevel } from '@prisma/client';


class ReactionItemDto {
  @IsUUID()
  reactionId: string;

  @IsOptional()
  @IsEnum(SeverityLevel)
  severity?: SeverityLevel;
}

export class AddMealReactionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReactionItemDto)
  reactions: ReactionItemDto[];
}