import { IsString } from 'class-validator';

export class RefreshDto {
  @IsString({ message: 'Некорректный токен' })
  refreshToken: string;
}
