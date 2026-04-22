export const visionSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          grams: { type: 'number' },
          confidence: { type: 'number' },
        },
        required: ['name', 'grams', 'confidence'],
        additionalProperties: false,
      },
    },
    notes: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['items'],
  additionalProperties: false,
} as const;
