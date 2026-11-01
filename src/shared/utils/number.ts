/** Округление до двух знаков — единый формат всех числовых полей в ответах API. */
export function round2(value: number): number {
  return Number(value.toFixed(2));
}
