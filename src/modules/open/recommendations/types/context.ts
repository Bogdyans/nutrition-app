export type Gender = 'MALE' | 'FEMALE' | null;

export interface RecommendationProfile {
  gender: Gender;
  age: number | null;
  heightCm: number | null;
  currentWeightKg: number | null;
  activityLevel: string;
  weightTrend7d: number;
}

export interface RecommendationMeal {
  timestamp: Date;
  totals: {
    calories: number;
    proteins: number;
    fats: number;
    carbs: number;
  };
  items: string[];
}

export interface RecommendationReaction {
  name: string;
  reactionRate: number;
}

export interface RecommendationContext {
  profile: RecommendationProfile;
  recentMeals: RecommendationMeal[];
  reactions: RecommendationReaction[];
}
