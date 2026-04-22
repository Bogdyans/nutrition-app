import { RecognizeInput } from '../../domain/types';

export function buildPrompt(input: RecognizeInput) {
  return {
    role: 'user' as const,
    content: [
      {
        type: 'input_text' as const,
        text: input.hint
          ? `Analyze this meal photo. Context: ${input.hint}`
          : 'Analyze this meal photo',
      },
      {
        type: 'input_image' as const,
        image_url: `data:${input.mimeType};base64,${input.imageBase64}`,
        detail: 'high' as const,
      },
    ],
  };
}
