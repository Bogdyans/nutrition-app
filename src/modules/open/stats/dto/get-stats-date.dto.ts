import { IsNotEmpty, Matches } from 'class-validator';

export class GetStatsDayDto {
  @IsNotEmpty({ message: 'Укажите дату' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Используйте формат даты ГГГГ-ММ-ДД',
  })
  date: string;
}
