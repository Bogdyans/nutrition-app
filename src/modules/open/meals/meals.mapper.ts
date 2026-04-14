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

export function calculateMealTotalsRaw(meal: MealStatsInput): NutritionTotals {
  return meal.items.reduce<NutritionTotals>(
    (acc, item) => {
      const factor = item.weightG / 100;

      acc.calories += item.product.calories * factor;
      acc.proteins += item.product.proteins * factor;
      acc.fats += item.product.fats * factor;
      acc.carbs += item.product.carbs * factor;

      return acc;
    },
    { calories: 0, proteins: 0, fats: 0, carbs: 0 },
  );
}

export function normalizeNutritionTotals(totals: NutritionTotals) {
  return {
    calories: Number(totals.calories.toFixed(2)),
    proteins: Number(totals.proteins.toFixed(2)),
    fats: Number(totals.fats.toFixed(2)),
    carbs: Number(totals.carbs.toFixed(2)),
  };
}

export function calculateMealTotals(meal: MealStatsInput) {
  return normalizeNutritionTotals(calculateMealTotalsRaw(meal));
}
