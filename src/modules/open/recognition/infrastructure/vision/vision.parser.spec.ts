import { VisionParser } from './vision.parser';

describe('VisionParser', () => {
  it('should parse valid JSON', () => {
    const input = '{"items":[]}';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = VisionParser.safeParse(input);

    expect(result).toEqual({ items: [] });
  });

  it('should strip markdown fences', () => {
    const input = '```json\n{"items":[]}\n```';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = VisionParser.safeParse(input);

    expect(result).toEqual({ items: [] });
  });

  it('should throw on empty input', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    expect(() => VisionParser.safeParse('')).toThrow('Empty model response');
  });

  it('should throw on invalid JSON', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    expect(() => VisionParser.safeParse('invalid json')).toThrow(
      'Invalid JSON from model',
    );
  });
});
