import { IsUUID } from 'class-validator';

export class CreateConsultationChatDto {
  @IsUUID()
  consultantId: string;
}
