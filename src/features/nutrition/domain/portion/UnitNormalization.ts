const GERMAN_NUMBER_WORDS: Record<string, number> = {
  eins: 1,
  ein: 1,
  eine: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  funf: 5,
  fuenf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
};

export function normalizePortionText(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ä/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ');
}

export function parseLocaleNumber(raw: string): number | null {
  const normalized = raw.replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseNumberToken(token: string): number | null {
  const numeric = parseLocaleNumber(token);
  if (numeric !== null) {
    return numeric;
  }

  return GERMAN_NUMBER_WORDS[token] ?? null;
}
