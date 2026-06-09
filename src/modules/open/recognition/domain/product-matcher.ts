import { RecognizedFoodItem } from './types';

const MAX_MATCHES_PER_ITEM = 5;
const MIN_TOKEN_LENGTH = 3;

type Named = { id: string; name: string };

export type MatchResult<T extends Named> = {
  items: { recognized: RecognizedFoodItem; matches: T[] }[];
  unmatched: RecognizedFoodItem[];
};

/** Lower-case, trim, and collapse internal whitespace (works for Cyrillic). */
export function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Significant words of a name, falling back to the whole name if all words are short. */
function tokenize(name: string): string[] {
  const normalized = normalizeName(name);
  const words = normalized.split(' ').filter((w) => w.length >= MIN_TOKEN_LENGTH);
  return words.length ? words : [normalized];
}

/**
 * The distinct search terms to query the DB with: each recognized food's full
 * name plus its significant words, so a multi-word name like "жареное яйцо"
 * can still match a product named just "яйцо".
 */
export function collectSearchTerms(items: RecognizedFoodItem[]): string[] {
  const terms = new Set<string>();
  for (const item of items) {
    terms.add(normalizeName(item.name));
    for (const token of tokenize(item.name)) terms.add(token);
  }
  return [...terms];
}

function score(productName: string, term: string, tokens: string[]): number {
  if (productName === term) return 1000;

  let value = 0;
  if (productName.includes(term) || term.includes(productName)) value += 100;
  for (const token of tokens) {
    if (productName.includes(token)) value += 10;
  }
  if (productName.startsWith(tokens[0])) value += 5;
  return value;
}

function rank<T extends Named>(recognizedName: string, candidates: T[]): T[] {
  const term = normalizeName(recognizedName);
  const tokens = tokenize(recognizedName);

  return candidates
    .map((candidate) => ({
      candidate,
      score: score(normalizeName(candidate.name), term, tokens),
    }))
    .filter((scored) => scored.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || a.candidate.name.length - b.candidate.name.length,
    )
    .slice(0, MAX_MATCHES_PER_ITEM)
    .map((scored) => scored.candidate);
}

/**
 * Pairs each recognized food with its best-matching products from `candidates`.
 * Foods with no matching candidate go to `unmatched`.
 */
export function matchProducts<T extends Named>(
  items: RecognizedFoodItem[],
  candidates: T[],
): MatchResult<T> {
  const matched: MatchResult<T>['items'] = [];
  const unmatched: RecognizedFoodItem[] = [];

  for (const recognized of items) {
    const matches = rank(recognized.name, candidates);
    if (matches.length) {
      matched.push({ recognized, matches });
    } else {
      unmatched.push(recognized);
    }
  }

  return { items: matched, unmatched };
}
