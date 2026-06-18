const NUMBER_REGEX = /^(\d+)\s*([a-zA-ZäöüÄÖÜß]*)\s+(.*)$/i;
const UNIT_REGEX =
  /^(\d+)\s*(g|kg|ml|l|gramm|kilogramm|milliliter|liter|stück|stueck|piece|pieces|scheibe|scheiben|slice|slices)\s+(.*)$/i;
const NUMBER_WORD_WITH_UNIT_REGEX =
  /^(ein|eine|einen|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\s+(g|kg|ml|l|gramm|kilogramm|milliliter|liter|stück|stueck|piece|pieces|scheibe|scheiben|slice|slices)\s+(.+)$/i;

const UNIT_ALIASES: Record<string, string> = {
  g: 'g',
  gramm: 'g',
  kg: 'kg',
  kilogramm: 'kg',
  ml: 'ml',
  milliliter: 'ml',
  l: 'l',
  liter: 'l',
  stück: 'piece',
  stueck: 'piece',
  piece: 'piece',
  pieces: 'piece',
  scheibe: 'slice',
  scheiben: 'slice',
  slice: 'slice',
  slices: 'slice',
};

// Deutsche Zahlwörter
const GERMAN_NUMBER_WORDS: Record<string, number> = {
  ein: 1,
  eine: 1,
  einen: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
};

// Einfache Modifier, die entfernt werden können
const REMOVABLE_MODIFIERS = [
  'gekocht',
  'gekochte',
  'gekochter',
  'gekochtes',
  'gebraten',
  'gebratene',
  'gebratener',
  'gebratenes',
  'frisch',
  'frische',
  'frischer',
  'frisches',
];

const MULTI_ITEM_CONNECTOR_PATTERN = /\s*(?:,|&|\b(?:und|mit|and|with)\b)\s*/gi;

function normalizeUnit(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const normalized = unit.toLowerCase().trim();
  return UNIT_ALIASES[normalized] ?? normalized;
}

function normalizeItemName(name: string): string {
  let normalized = name.toLowerCase().trim();

  // Entferne mehrfache Leerzeichen
  normalized = normalized.replace(/\s+/g, ' ');

  // Entferne einfache Interpunktion
  normalized = normalized.replace(/[.,!?;:]/g, '');

  // Entferne Modifier
  for (const modifier of REMOVABLE_MODIFIERS) {
    const regex = new RegExp(`\\b${modifier}\\b`, 'gi');
    normalized = normalized.replace(regex, '').trim();
  }

  // Entferne mehrfache Leerzeichen nach Modifier-Entfernung
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

function parseQuantityAndUnit(part: string): {
  quantity: number | null;
  unit: string | null;
  foodName: string;
} {
  const trimmed = part.trim();

  // Prüfe auf deutsche Zahlwörter am Anfang
  const words = trimmed.split(/\s+/);
  const firstWord = words[0]?.toLowerCase();

  const numberWordWithUnitMatch = trimmed.match(NUMBER_WORD_WITH_UNIT_REGEX);
  if (numberWordWithUnitMatch) {
    return {
      quantity: GERMAN_NUMBER_WORDS[numberWordWithUnitMatch[1].toLowerCase()],
      unit: normalizeUnit(numberWordWithUnitMatch[2]),
      foodName: normalizeItemName(numberWordWithUnitMatch[3]),
    };
  }

  if (GERMAN_NUMBER_WORDS[firstWord]) {
    const quantity = GERMAN_NUMBER_WORDS[firstWord];
    const remainingWords = words.slice(1).join(' ');
    return {
      quantity,
      unit: null,
      foodName: normalizeItemName(remainingWords),
    };
  }

  // Prüfe auf Zahlen mit Einheiten (z.B. "200g Eier")
  const unitMatch = trimmed.match(UNIT_REGEX);
  if (unitMatch) {
    return {
      quantity: parseInt(unitMatch[1], 10),
      unit: normalizeUnit(unitMatch[2]),
      foodName: normalizeItemName(unitMatch[3]),
    };
  }

  // Prüfe auf einfache Zahlen (z.B. "2 Eier")
  const numberMatch = trimmed.match(NUMBER_REGEX);
  if (numberMatch) {
    const unit = numberMatch[2] || null;
    return {
      quantity: parseInt(numberMatch[1], 10),
      unit: normalizeUnit(unit),
      foodName: normalizeItemName(numberMatch[3]),
    };
  }

  // Keine Menge gefunden
  return {
    quantity: null,
    unit: null,
    foodName: normalizeItemName(trimmed),
  };
}

export function simpleParse(input: string) {
  // Split input by supported P1-003 connectors while preserving per-item raw text.
  const rawParts = input
    .replace(MULTI_ITEM_CONNECTOR_PATTERN, '|')
    .replace(/[.!?;:]/g, '') // Remove punctuation that is not a connector
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  // Normalize input for parsing quantities and units
  const normalized = input
    .toLowerCase()
    .replace(MULTI_ITEM_CONNECTOR_PATTERN, '|')
    .replace(/[.!?;:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const normalizedParts = normalized
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  // Map raw and normalized parts together
  const items = normalizedParts.map((normPart, index) => {
    const rawText = rawParts[index] || normPart;
    const { quantity, unit, foodName } = parseQuantityAndUnit(normPart);
    if (foodName.length === 0) return null;
    return {
      name: foodName.toLowerCase(),
      quantity,
      unit,
      rawText,
    };
  });

  return items.filter(
    (
      item,
    ): item is { name: string; quantity: number | null; unit: string | null; rawText: string } =>
      item !== null && item.name.length > 0,
  );
}
