import {
  addTotals,
  calculateMealTotalsRaw,
  createEmptyTotals,
  divideTotals,
  normalizeNutritionTotals,
  sumMealsTotalsRaw,
  toMealItemBreakdown,
} from './meals.mapper';

const product = (calories: number, proteins = 0, fats = 0, carbs = 0) => ({
  name: 'Тестовый продукт',
  calories,
  proteins,
  fats,
  carbs,
});

describe('calculateMealTotalsRaw', () => {
  it('пересчитывает пищевую ценность со 100 г на фактический вес', () => {
    const totals = calculateMealTotalsRaw({
      items: [{ weightG: 250, product: product(100, 10, 5, 20) }],
    });

    expect(totals).toEqual({
      calories: 250,
      proteins: 25,
      fats: 12.5,
      carbs: 50,
    });
  });

  it('суммирует несколько позиций', () => {
    const totals = calculateMealTotalsRaw({
      items: [
        { weightG: 100, product: product(100, 10, 5, 20) },
        { weightG: 50, product: product(200, 20, 10, 40) },
      ],
    });

    expect(totals).toEqual({
      calories: 200,
      proteins: 20,
      fats: 10,
      carbs: 40,
    });
  });

  it('для пустого приёма пищи возвращает нули', () => {
    expect(calculateMealTotalsRaw({ items: [] })).toEqual(createEmptyTotals());
  });

  it('не накапливает состояние между вызовами', () => {
    const meal = { items: [{ weightG: 100, product: product(100) }] };

    expect(calculateMealTotalsRaw(meal)).toEqual(calculateMealTotalsRaw(meal));
  });
});

describe('normalizeNutritionTotals', () => {
  it('округляет до двух знаков', () => {
    expect(
      normalizeNutritionTotals({
        calories: 1.006,
        proteins: 2.344,
        fats: 3.0,
        carbs: 4.999,
      }),
    ).toEqual({ calories: 1.01, proteins: 2.34, fats: 3, carbs: 5 });
  });

  it('округляет ровную половину вниз — артефакт двоичного представления', () => {
    // 1.005 в double это на самом деле 1.00499…, поэтому toFixed(2) даёт
    // «1.00». Для калорий сотая доли роли не играет, поэтому живём с этим;
    // тест фиксирует поведение, чтобы оно не поменялось молча.
    expect(normalizeNutritionTotals(createEmptyTotals()).calories).toBe(0);
    expect(
      normalizeNutritionTotals({
        calories: 1.005,
        proteins: 0,
        fats: 0,
        carbs: 0,
      }).calories,
    ).toBe(1);
  });

  it('копит точность до округления, а не округляет каждую позицию', () => {
    // Три позиции по 0.333… — при поштучном округлении дало бы 0.99.
    const totals = calculateMealTotalsRaw({
      items: Array.from({ length: 3 }, () => ({
        weightG: 100,
        product: product(1 / 3),
      })),
    });

    expect(normalizeNutritionTotals(totals).calories).toBe(1);
  });
});

describe('addTotals', () => {
  it('прибавляет источник к цели на месте', () => {
    const target = createEmptyTotals();

    addTotals(target, { calories: 10, proteins: 1, fats: 2, carbs: 3 });
    addTotals(target, { calories: 5, proteins: 1, fats: 1, carbs: 1 });

    expect(target).toEqual({ calories: 15, proteins: 2, fats: 3, carbs: 4 });
  });
});

describe('divideTotals', () => {
  it('делит и округляет', () => {
    expect(
      divideTotals({ calories: 700, proteins: 70, fats: 35, carbs: 140 }, 7),
    ).toEqual({ calories: 100, proteins: 10, fats: 5, carbs: 20 });
  });

  it('на нулевом делителе возвращает нули, а не Infinity', () => {
    expect(
      divideTotals({ calories: 700, proteins: 70, fats: 35, carbs: 140 }, 0),
    ).toEqual(createEmptyTotals());
  });
});

describe('sumMealsTotalsRaw', () => {
  it('складывает несколько приёмов пищи', () => {
    const totals = sumMealsTotalsRaw([
      { items: [{ weightG: 100, product: product(100, 10) }] },
      { items: [{ weightG: 200, product: product(50, 5) }] },
    ]);

    expect(totals.calories).toBe(200);
    expect(totals.proteins).toBe(20);
  });

  it('для пустого списка возвращает нули', () => {
    expect(sumMealsTotalsRaw([])).toEqual(createEmptyTotals());
  });
});

describe('toMealItemBreakdown', () => {
  it('раскрывает позицию с пересчитанной на вес ценностью', () => {
    expect(
      toMealItemBreakdown({
        id: 'item-1',
        productId: 'product-1',
        weightG: 150,
        product: { ...product(100, 10, 5, 20), name: 'Гречка' },
      }),
    ).toEqual({
      id: 'item-1',
      productId: 'product-1',
      productName: 'Гречка',
      weightG: 150,
      calories: 150,
      proteins: 15,
      fats: 7.5,
      carbs: 30,
    });
  });
});
