import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { RecognizeInput } from '../../domain/types';

/** Builds the user turn for the chat-completions vision request. */
export function buildUserMessage(
  input: RecognizeInput,
): ChatCompletionMessageParam {
  const text =
    'Identify visible food items. ' +
    'Estimate weight in grams. ' +
    'Be conservative. ' +
    'Do not guess unseen ingredients.' +
    (input.hint ? `\nContext: ${input.hint}` : '');

  return {
    role: 'user',
    content: [
      { type: 'text', text },
      {
        type: 'image_url',
        image_url: {
          url: `data:${input.mimeType};base64,${input.imageBase64}`,
          detail: 'low',
        },
      },
    ],
  };
}
