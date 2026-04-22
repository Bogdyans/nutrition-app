import { normalizeItems } from './normalize';

describe('normalizeItems', () => {
  it('should trim name and round values correctly', () => {
    const result = normalizeItems([
      {
        name: ' Apple ',
        grams: 123.456,
        confidence: 0.9876,
      },
    ]);

    expect(result).toEqual([
      {
        name: 'Apple',
        grams: 123.5,
        confidence: 0.99,
      },
    ]);
  });

  it('should handle multiple items', () => {
    const result = normalizeItems([
      { name: ' A ', grams: 1.234, confidence: 0.111 },
      { name: ' B ', grams: 2.345, confidence: 0.222 },
    ]);

    expect(result).toEqual([
      { name: 'A', grams: 1.2, confidence: 0.11 },
      { name: 'B', grams: 2.3, confidence: 0.22 },
    ]);
  });
});
