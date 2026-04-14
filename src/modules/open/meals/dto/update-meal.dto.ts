import {
  IsDateString,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class UpdateMealDto {
  @IsOptional()
  @IsDateString()
  timestamp?: string;

  @IsOptional()
  @ValidateIf((object, value) => value !== null)
  @IsString()
  photoUrl?: string | null;
}
