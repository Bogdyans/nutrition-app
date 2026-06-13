import { BadRequestException } from '@nestjs/common';

export function normalizeDate(input: string): Date {
  const date = new Date(input);

  if (isNaN(date.getTime())) {
    throw new BadRequestException('Некорректный формат даты');
  }

  // Обнуляем время ВСЕГДА
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}
