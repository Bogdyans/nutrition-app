import { IsEnum } from 'class-validator';
import { ProductVisibility } from '@prisma/client';

export class UpdateVisibilityDto {
  @IsEnum(ProductVisibility)
  visibility: ProductVisibility;
}
