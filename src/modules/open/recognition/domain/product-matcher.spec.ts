import { collectSearchTerms, matchProducts } from './product-matcher';
import { RecognizedFoodItem } from './types';

const product = (id: string, name: string) => ({ id, name });
const recognized = (name: string): RecognizedFoodItem => ({
  name,
  grams: 100,
  confidence: 0.9,
});

describe('matchProducts', () => {
  it('matches a recognized food to products and groups them', () => {
    const candidates = [product('p1', 'Яйцо куриное жареное')];

    const result = matchProducts([recognized('Жареное яйцо')], candidates);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].matches).toEqual(candidates);
    expect(result.unmatched).toEqual([]);
  });

  it('ranks an exact name match above a partial one', () => {
    const partial = product('p1', 'Яйцо куриное жареное');
    const exact = product('p2', 'Жареное яйцо');

    const result = matchProducts(
      [recognized('Жареное яйцо')],
      [partial, exact],
    );

    expect(result.items[0].matches[0]).toBe(exact);
  });

  it('puts foods with no candidate into unmatched', () => {
    const result = matchProducts(
      [recognized('Соус песто')],
      [product('p1', 'Яйцо')],
    );

    expect(result.items).toEqual([]);
    expect(result.unmatched).toEqual([recognized('Соус песто')]);
  });

  it('caps matches at 5 per recognized food', () => {
    const candidates = Array.from({ length: 8 }, (_, i) =>
      product(`p${i}`, `Яйцо вариант ${i}`),
    );

    const result = matchProducts([recognized('Яйцо')], candidates);

    expect(result.items[0].matches).toHaveLength(5);
  });
});

describe('collectSearchTerms', () => {
  it('includes the full normalized name and its significant words', () => {
    const terms = collectSearchTerms([recognized('Жареное яйцо')]);

    expect(terms).toContain('жареное яйцо');
    expect(terms).toContain('жареное');
    expect(terms).toContain('яйцо');
  });

  it('deduplicates terms across foods', () => {
    const terms = collectSearchTerms([recognized('Яйцо'), recognized('Яйцо')]);

    expect(terms).toEqual(['яйцо']);
  });
});
