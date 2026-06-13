import { IsUUID } from 'class-validator';

export class CreateConsultationChatDto {
  @IsUUID(undefined, { message: 'Некорректный идентификатор консультанта' })
  consultantId: string;
}
