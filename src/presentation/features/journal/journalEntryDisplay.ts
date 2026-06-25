import type { FoodEntry } from '../../../features/nutrition';

type DisplayUnit = 'g' | 'piece' | 'slice' | 'count';

interface ParsedDisplayQuantity {
  count?: number;
  grams?: number;
  unit?: DisplayUnit;
}

export interface FoodEntryDisplay {
  title: string;
  subtitle?: string;
}

const GERMAN_UNIT_LABELS: Record<
  Exclude<DisplayUnit, 'g'>,
  { singular: string; plural: string }
> = {
  piece: { singular: 'Stück', plural: 'Stück' },
  count: { singular: 'Stück', plural: 'Stück' },
  slice: { singular: 'Scheibe', plural: 'Scheiben' },
};

const NUMBER_WORDS: Record<string, number> = {
  ein: 1,
  eine: 1,
  einen: 1,
  eins: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  fuenf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
};

const UNIT_ALIASES: Record<string, DisplayUnit> = {
  stück: 'piece',
  stueck: 'piece',
  piece: 'piece',
  pieces: 'piece',
  scheibe: 'slice',
  scheiben: 'slice',
  slice: 'slice',
  slices: 'slice',
};

function formatTitle(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  return trimmed.charAt(0).toLocaleUpperCase('de-DE') + trimmed.slice(1);
}

function formatNumber(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
}

function formatUnitLabel(unit: Exclude<DisplayUnit, 'g'>, count: number) {
  const labels = GERMAN_UNIT_LABELS[unit];
  return count === 1 ? labels.singular : labels.plural;
}

function parseDisplayQuantity(rawInput: string): ParsedDisplayQuantity {
  const normalized = rawInput.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return {};

  const gramsMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gramm)\b/);
  if (gramsMatch) {
    return {
      grams: Number.parseFloat(gramsMatch[1].replace(',', '.')),
      unit: 'g',
    };
  }

  const numericUnitMatch = normalized.match(
    /^(\d+(?:[.,]\d+)?)\s*(stück|stueck|piece|pieces|scheibe|scheiben|slice|slices)\b/,
  );
  if (numericUnitMatch) {
    return {
      count: Number.parseFloat(numericUnitMatch[1].replace(',', '.')),
      unit: UNIT_ALIASES[numericUnitMatch[2]],
    };
  }

  const numberWordUnitMatch = normalized.match(
    /^(\S+)\s+(stück|stueck|piece|pieces|scheibe|scheiben|slice|slices)\b/,
  );
  if (numberWordUnitMatch && NUMBER_WORDS[numberWordUnitMatch[1]] !== undefined) {
    return {
      count: NUMBER_WORDS[numberWordUnitMatch[1]],
      unit: UNIT_ALIASES[numberWordUnitMatch[2]],
    };
  }

  const countMatch = normalized.match(/^(\d+(?:[.,]\d+)?)\s*x?\s+/);
  if (countMatch) {
    return {
      count: Number.parseFloat(countMatch[1].replace(',', '.')),
      unit: 'count',
    };
  }

  const numberWordMatch = normalized.match(/^(\S+)\s+/);
  if (numberWordMatch && NUMBER_WORDS[numberWordMatch[1]] !== undefined) {
    return {
      count: NUMBER_WORDS[numberWordMatch[1]],
      unit: 'count',
    };
  }

  return {};
}

function buildSubtitle(rawInput: string, grams: number | null | undefined) {
  if (!grams || grams <= 0) return undefined;

  const parsed = parseDisplayQuantity(rawInput);
  const gramsText = `${formatNumber(grams)} g`;

  if (parsed.unit === 'g') {
    return gramsText;
  }

  if (parsed.count && parsed.count > 0 && parsed.unit) {
    return `${formatNumber(parsed.count)} ${formatUnitLabel(parsed.unit, parsed.count)} (${gramsText})`;
  }

  return gramsText;
}

export function buildFoodEntryDisplay(entry: FoodEntry): FoodEntryDisplay {
  const titleSource = entry.parsedName || entry.rawInput;
  const grams = entry.grams ?? entry.quantityGrams;

  return {
    title: formatTitle(titleSource),
    subtitle: buildSubtitle(entry.rawInput, grams),
  };
}
