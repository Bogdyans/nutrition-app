import { UnprocessableEntityException } from '@nestjs/common';
import { RecognizedFoodItem } from './types';

export interface ParsedVisionOutput {
  items: RecognizedFoodItem[];
  notes?: string[];
}

/**
 * Validates the JSON the vision model returned against the shape we rely on.
 * Free / non-structured models frequently ignore the response schema, so the
 * payload is untrusted: anything malformed becomes a 422 instead of a later
 * `TypeError` (e.g. calling `.toFixed` on a missing field) surfacing as a 500.
 */
export function parseVisionOutput(value: unknown): ParsedVisionOutput {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new UnprocessableEntityException(
      'Сервис распознавания вернул неожиданный ответ',
    );
  }

  const items = value.items.map(parseItem);

  if (value.notes !== undefined && !isStringArray(value.notes)) {
    throw new UnprocessableEntityException(
      'Сервис распознавания вернул некорректные данные',
    );
  }

  return { items, notes: value.notes };
}

function parseItem(value: unknown): RecognizedFoodItem {
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    value.name.trim().length === 0 ||
    !isFiniteNumber(value.grams) ||
    !isFiniteNumber(value.confidence)
  ) {
    throw new UnprocessableEntityException(
      'Сервис распознавания вернул некорректную позицию',
    );
  }

  return {
    name: value.name,
    grams: value.grams,
    confidence: value.confidence,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}
