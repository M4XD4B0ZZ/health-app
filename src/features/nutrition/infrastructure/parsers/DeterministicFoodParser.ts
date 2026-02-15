/**
 * Ergebnis des deterministischen Parsings.
 */
export interface DeterministicParseResult {
  name: string;
  quantityGrams?: number;
  quantityCount?: number;
  unit?: string;
}

/**
 * Deterministischer Parser ohne AI/LLM.
 * Erkennt Patterns wie:
 * - "250g chicken breast" -> 250g
 * - "skyr 200 g" -> 200g
 * - "2 eggs" -> count 2
 * - "3x eggs" -> count 3
 * - "banana" -> keine Menge
 */
export class DeterministicFoodParser {
  parse(rawInput: string): DeterministicParseResult {
    const normalized = rawInput.trim().toLowerCase();

    // Pattern für Gramm: "250g", "250 g", "250.5g"
    const gramsMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*g\b/);
    
    // Pattern für Count: "2 eggs", "2x eggs", "3x", "2 x"
    const countMatch = normalized.match(/^(\d+)\s*x?\s+/i) || normalized.match(/^(\d+)\s*x\s*$/i);

    let name = normalized;
    let quantityGrams: number | undefined;
    let quantityCount: number | undefined;
    let unit: string | undefined;

    // Gramm-Pattern gefunden
    if (gramsMatch) {
      quantityGrams = Number.parseFloat(gramsMatch[1].replace(',', '.'));
      unit = 'g';
      // Entferne Gramm-Angabe aus dem Namen
      name = normalized
        .replace(/(\d+(?:[.,]\d+)?)\s*g\b/g, '')
        .trim();
    }
    // Count-Pattern gefunden
    else if (countMatch) {
      quantityCount = Number.parseInt(countMatch[1], 10);
      unit = 'count';
      // Entferne Count-Angabe aus dem Namen
      name = normalized
        .replace(/^(\d+)\s*x?\s+/i, '')
        .replace(/^(\d+)\s*x\s*$/i, '')
        .trim();
    }

    // Normalize name: collapse multiple spaces
    name = name.replace(/\s+/g, ' ').trim();

    // Falls Name leer ist (z.B. nur "250g"), verwende Original
    if (!name) {
      name = normalized.replace(/\s+/g, ' ').trim();
    }

    return {
      name,
      quantityGrams,
      quantityCount,
      unit,
    };
  }
}
