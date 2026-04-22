export class VisionParser {
  static safeParse(text: string) {
    if (!text) throw new Error('Empty model response');

    // sanitize common LLM issues
    const cleaned = text
      .trim()
      .replace(/^```json/, '')
      .replace(/```$/, '')
      .trim();

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return JSON.parse(cleaned);
    } catch {
      throw new Error(`Invalid JSON from model: ${cleaned.slice(0, 300)}`);
    }
  }
}
