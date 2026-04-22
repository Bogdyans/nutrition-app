import { RecognizeInput } from '../../domain/types';

export function buildPrompt(input: RecognizeInput) {
  return {
    role: 'user' as const,
    content: [
      {
        type: 'input_text' as const,
        text: `Identify visible food items. 
          Estimate weight in grams. 
          Be conservative. 
          Do not guess unseen ingredients.
          ${input.hint ? `Context: ${input.hint}` : ''}`,
      },
      {
        type: 'input_image' as const,
        image_url: `data:${input.mimeType};base64,${input.imageBase64}`,
        detail: 'high' as const,
      },
    ],
  };
}
