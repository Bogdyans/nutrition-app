import { IsOptional, IsString } from 'class-validator';

export class RecognizeMealDto {
  @IsOptional()
  @IsString()
  hint?: string;
}
