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

/** Exported for reuse by journalLastSubmitConfirmation.ts (J-008) — same German 1-decimal-comma rounding. */
export function formatNumber(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
}

function formatUnitLabel(unit: Exclude<DisplayUnit, 'g'>, count: number) {
  const labels = GERMAN_UNIT_LABELS[unit];
  return count === 1 ? labels.singular : labels.plural;
}

/** Exported for reuse by journalLastSubmitConfirmation.ts (J-008) — same raw-text count parsing. */
export function parseDisplayQuantity(rawInput: string): ParsedDisplayQuantity {
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

/**
 * P1-003C: a composite-dish group (e.g. "Fruchtsalat mit Bananen, Kirschen") - the
 * label itself is never a persisted FoodEntry, so the group total is always exactly
 * the sum of its children's macros (no separate total to keep in sync, and deleting
 * the last child makes the group disappear on the next grouping pass for free).
 */
export interface JournalEntryGroup {
  kind: 'group';
  groupId: string;
  label: string;
  children: FoodEntry[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export interface JournalEntryLeaf {
  kind: 'entry';
  entry: FoodEntry;
}

export type JournalListItem = JournalEntryGroup | JournalEntryLeaf;

/**
 * Groups entries sharing a groupId (set by P1-003B/C composite-dish detection) under
 * a single JournalEntryGroup, in the position of their first-seen child. Entries
 * without a groupId pass through unchanged as JournalEntryLeaf items.
 */
export function groupJournalEntries(entries: FoodEntry[]): JournalListItem[] {
  const result: JournalListItem[] = [];
  const groupIndexByGroupId = new Map<string, number>();

  for (const entry of entries) {
    if (!entry.groupId) {
      result.push({ kind: 'entry', entry });
      continue;
    }

    const existingIndex = groupIndexByGroupId.get(entry.groupId);
    if (existingIndex === undefined) {
      groupIndexByGroupId.set(entry.groupId, result.length);
      result.push({
        kind: 'group',
        groupId: entry.groupId,
        label: formatTitle(entry.groupLabel ?? ''),
        children: [entry],
        totalCalories: entry.calories,
        totalProtein: entry.protein,
        totalCarbs: entry.carbs,
        totalFat: entry.fat,
      });
      continue;
    }

    const group = result[existingIndex] as JournalEntryGroup;
    group.children.push(entry);
    group.totalCalories += entry.calories;
    group.totalProtein += entry.protein;
    group.totalCarbs += entry.carbs;
    group.totalFat += entry.fat;
  }

  return result;
}
