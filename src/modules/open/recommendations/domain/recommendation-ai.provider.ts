export const RECOMMENDATION_AI_PROVIDER = Symbol('RECOMMENDATION_AI_PROVIDER');

export interface RecommendationAiProvider {
  generateText(prompt: string): Promise<string>;
}
