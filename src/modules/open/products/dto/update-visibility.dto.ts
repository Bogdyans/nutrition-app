import { IsEnum } from 'class-validator';
import { ProductVisibility } from '@prisma/client';

export class UpdateVisibilityDto {
  @IsEnum(ProductVisibility, { message: 'Недопустимое значение видимости' })
  visibility: ProductVisibility;
}
