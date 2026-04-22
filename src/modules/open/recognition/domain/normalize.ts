import { RecognizedFoodItem } from './types';

export function normalizeItems(
  items: RecognizedFoodItem[],
): RecognizedFoodItem[] {
  return items.map((item) => ({
    name: item.name.trim(),
    grams: Number(item.grams.toFixed(1)),
    confidence: Number(item.confidence.toFixed(2)),
  }));
}