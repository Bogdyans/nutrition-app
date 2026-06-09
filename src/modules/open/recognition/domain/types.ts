import { Product } from '@prisma/client';

export type RecognizedFoodItem = {
  name: string;
  grams: number;
  confidence: number;
};

/** One recognized food paired with the DB products it matched. */
export type RecognizedMatchGroup = {
  recognized: RecognizedFoodItem;
  matches: Product[];
};

/**
 * Result of recognising a meal photo: foods that matched at least one product
 * in the user's catalogue (grouped with their candidates), plus the foods that
 * matched nothing so the client can offer to create them manually.
 */
export type RecognitionResult = {
  items: RecognizedMatchGroup[];
  unmatched: RecognizedFoodItem[];
  notes?: string[];
};

export type RecognizeInput = {
  imageBase64: string;
  mimeType: string;
  hint?: string;
};
