import { round2 } from '../../../shared/utils/number';

export type MealItemInput = {
  id: string;
  productId: string;
  weightG: number;
  product: {
    name: string;
    calories: number;
    proteins: number;
    fats: number;
    carbs: number;
  };
};

export type MealStatsInput = {
  items: {
    weightG: number;
    product: {
      calories: number;
      proteins: number;
      fats: number;
      carbs: number;
    };
  }[];
};

export type NutritionTotals = {
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
};

export type MealItemBreakdown = {
  id: string;
  productId: string;
  productName: string;
  weightG: number;
} & NutritionTotals;

export function createEmptyTotals(): NutritionTotals {
  return { calories: 0, proteins: 0, fats: 0, carbs: 0 };
}

export function addTotals(target: NutritionTotals, source: NutritionTotals) {
  target.calories += source.calories;
  target.proteins += source.proteins;
  target.fats += source.fats;
  target.carbs += source.carbs;
}

export function calculateMealTotalsRaw(meal: MealStatsInput): NutritionTotals {
  return meal.items.reduce<NutritionTotals>((acc, item) => {
    const factor = item.weightG / 100;

    acc.calories += item.product.calories * factor;
    acc.proteins += item.product.proteins * factor;
    acc.fats += item.product.fats * factor;
    acc.carbs += item.product.carbs * factor;

    return acc;
  }, createEmptyTotals());
}

export function normalizeNutritionTotals(
  totals: NutritionTotals,
): NutritionTotals {
  return {
    calories: round2(totals.calories),
    proteins: round2(totals.proteins),
    fats: round2(totals.fats),
    carbs: round2(totals.carbs),
  };
}

export function divideTotals(
  totals: NutritionTotals,
  divisor: number,
): NutritionTotals {
  if (divisor <= 0) {
    return normalizeNutritionTotals(createEmptyTotals());
  }

  return normalizeNutritionTotals({
    calories: totals.calories / divisor,
    proteins: totals.proteins / divisor,
    fats: totals.fats / divisor,
    carbs: totals.carbs / divisor,
  });
}

export function sumMealsTotalsRaw(meals: MealStatsInput[]): NutritionTotals {
  return meals.reduce<NutritionTotals>((acc, meal) => {
    addTotals(acc, calculateMealTotalsRaw(meal));

    return acc;
  }, createEmptyTotals());
}

/** Позиция приёма пищи с пересчитанной на её вес пищевой ценностью. */
export function toMealItemBreakdown(item: MealItemInput): MealItemBreakdown {
  const factor = item.weightG / 100;

  return {
    id: item.id,
    productId: item.productId,
    productName: item.product.name,
    weightG: round2(item.weightG),
    calories: round2(item.product.calories * factor),
    proteins: round2(item.product.proteins * factor),
    fats: round2(item.product.fats * factor),
    carbs: round2(item.product.carbs * factor),
  };
}
