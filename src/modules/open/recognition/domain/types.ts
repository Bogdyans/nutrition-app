export type RecognizedFoodItem = {
  name: string;
  grams: number;
  confidence: number;
};

export type RecognizeMealResult = {
  items: RecognizedFoodItem[];
  notes?: string[];
};

export type RecognizeInput = {
  imageBase64: string;
  mimeType: string;
  hint?: string;
};