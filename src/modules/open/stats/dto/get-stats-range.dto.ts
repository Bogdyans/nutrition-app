import { IsNotEmpty, Matches } from 'class-validator';

export class GetStatsRangeDto {
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from: string;

  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to: string;
}
