export function normalizeDate(date?: string): Date {
  if (!date) return new Date();

  return new Date(date.endsWith('Z') ? date : `${date}T00:00:00.000Z`);
}
