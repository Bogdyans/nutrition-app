import { IsNotEmpty, Matches } from 'class-validator';

export class GetStatsRangeDto {
  @IsNotEmpty({ message: 'Укажите начальную дату' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Используйте формат даты ГГГГ-ММ-ДД',
  })
  from: string;

  @IsNotEmpty({ message: 'Укажите конечную дату' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Используйте формат даты ГГГГ-ММ-ДД',
  })
  to: string;
}
