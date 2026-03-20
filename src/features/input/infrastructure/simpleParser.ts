const NUMBER_REGEX = /^(\d+)\s*([a-zA-Z]*)\s+(.*)$/i
const UNIT_REGEX = /^(\d+)\s*(g|kg|ml|l|gramm|kilogramm|milliliter|liter)\s+(.*)$/i

// Deutsche Zahlwörter
const GERMAN_NUMBER_WORDS: Record<string, number> = {
  'ein': 1,
  'eine': 1,
  'einen': 1,
  'zwei': 2,
  'drei': 3,
  'vier': 4,
  'fünf': 5,
  'sechs': 6,
  'sieben': 7,
  'acht': 8,
  'neun': 9,
  'zehn': 10
}

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
  'frisches'
]

function normalizeItemName(name: string): string {
  let normalized = name.toLowerCase().trim()
  
  // Entferne mehrfache Leerzeichen
  normalized = normalized.replace(/\s+/g, ' ')
  
  // Entferne einfache Interpunktion
  normalized = normalized.replace(/[.,!?;:]/g, '')
  
  // Entferne Modifier
  for (const modifier of REMOVABLE_MODIFIERS) {
    const regex = new RegExp(`\\b${modifier}\\b`, 'gi')
    normalized = normalized.replace(regex, '').trim()
  }
  
  // Entferne mehrfache Leerzeichen nach Modifier-Entfernung
  normalized = normalized.replace(/\s+/g, ' ').trim()
  
  return normalized
}

function parseQuantityAndUnit(part: string): { quantity: number | null, unit: string | null, foodName: string } {
  const trimmed = part.trim()
  
  // Prüfe auf deutsche Zahlwörter am Anfang
  const words = trimmed.split(/\s+/)
  const firstWord = words[0]?.toLowerCase()
  
  if (GERMAN_NUMBER_WORDS[firstWord]) {
    const quantity = GERMAN_NUMBER_WORDS[firstWord]
    const remainingWords = words.slice(1).join(' ')
    return {
      quantity,
      unit: null,
      foodName: normalizeItemName(remainingWords)
    }
  }
  
  // Prüfe auf Zahlen mit Einheiten (z.B. "200g Eier")
  const unitMatch = trimmed.match(UNIT_REGEX)
  if (unitMatch) {
    return {
      quantity: parseInt(unitMatch[1], 10),
      unit: unitMatch[2],
      foodName: normalizeItemName(unitMatch[3])
    }
  }
  
  // Prüfe auf einfache Zahlen (z.B. "2 Eier")
  const numberMatch = trimmed.match(NUMBER_REGEX)
  if (numberMatch) {
    const unit = numberMatch[2] || null
    return {
      quantity: parseInt(numberMatch[1], 10),
      unit: unit || null,
      foodName: normalizeItemName(numberMatch[3])
    }
  }
  
  // Keine Menge gefunden
  return {
    quantity: null,
    unit: null,
    foodName: normalizeItemName(trimmed)
  }
}

export function simpleParse(input: string) {
  // Split input by " und " without normalizing to preserve raw text
  const rawParts = input
    .replace(/[.,!?;:]/g, '') // Remove punctuation
    .replace(/,\s*/g, ' und ')
    .replace(/&\s*/g, ' und ')
    .split(/\s+und\s+/g)
    .map(part => part.trim())
    .filter(part => part.length > 0)

  // Normalize input for parsing quantities and units
  const normalized = input
    .toLowerCase()
    .replace(/[.,!?;:]/g, '')
    .replace(/,\s*/g, ' und ')
    .replace(/&\s*/g, ' und ')
    .replace(/\s+und\s+/g, ' und ')
    .replace(/\s+/g, ' ')
    .trim()
  const normalizedParts = normalized.split(' und ')

  // Map raw and normalized parts together
  const items = normalizedParts.map((normPart, index) => {
    const rawText = rawParts[index] || normPart
    const { quantity, unit, foodName } = parseQuantityAndUnit(normPart)
    if (foodName.length === 0) return null
    return {
      name: foodName.toLowerCase(),
      quantity,
      unit,
      rawText,
    }
  })

  return items.filter((item): item is { name: string; quantity: number | null; unit: string | null; rawText: string } => item !== null && item.name.length > 0)
}
