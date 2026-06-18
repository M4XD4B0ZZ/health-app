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
 * - "zwei äpfel" -> count 2, name "äpfel"
 * - "drei eier" -> count 3, name "eier"
 * - "banana" -> keine Menge
 */
export class DeterministicFoodParser {
  // Deutsche Zahlwörter 1-10
  private readonly germanNumberWords: Record<string, number> = {
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

  private readonly portionUnitAliases: Record<string, 'g' | 'piece' | 'slice'> = {
    g: 'g',
    gramm: 'g',
    stück: 'piece',
    stueck: 'piece',
    piece: 'piece',
    pieces: 'piece',
    scheibe: 'slice',
    scheiben: 'slice',
    slice: 'slice',
    slices: 'slice',
  };

  parse(rawInput: string): DeterministicParseResult {
    const normalized = rawInput.trim().toLowerCase();

    // Pattern für Gramm: "250g", "250 g", "250.5g", "250 gramm"
    const gramsMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gramm)\b/);

    const numericPortionUnitMatch = normalized.match(
      /^(\d+)\s*(stück|stueck|piece|pieces|scheibe|scheiben|slice|slices)\s+(.+)$/i,
    );

    // Pattern für deutsche "Xer" Counts: "20er nuggets", "6er nuggets"
    // Wichtig: "20er nuggets" bedeutet 20 Stück, NICHT ein Menü/Combo
    const germanCountMatch = normalized.match(/^(\d+)\s*er\s+(.+)$/i);

    // Pattern für Count: "2 eggs", "2x eggs", "3x", "2 x"
    const countMatch = normalized.match(/^(\d+)\s*x?\s+/i) || normalized.match(/^(\d+)\s*x\s*$/i);

    // Pattern für deutsche Zahlwörter: "zwei äpfel", "drei eier"
    const germanNumberWordMatch = this.matchGermanNumberWord(normalized);

    const germanNumberWordWithUnitMatch = this.matchGermanNumberWordWithUnit(normalized);

    let name = normalized;
    let quantityGrams: number | undefined;
    let quantityCount: number | undefined;
    let unit: string | undefined;

    // Gramm-Pattern gefunden
    if (gramsMatch) {
      quantityGrams = Number.parseFloat(gramsMatch[1].replace(',', '.'));
      unit = 'g';
      // Entferne Gramm-Angabe aus dem Namen
      name = normalized.replace(/(\d+(?:[.,]\d+)?)\s*(?:g|gramm)\b/g, '').trim();
    }
    // Explizite Stück-/Scheiben-Einheit mit Zahl: "2 scheiben toast"
    else if (numericPortionUnitMatch) {
      quantityCount = Number.parseInt(numericPortionUnitMatch[1], 10);
      unit = this.portionUnitAliases[numericPortionUnitMatch[2].toLowerCase()];
      name = numericPortionUnitMatch[3].trim();
    }
    // Deutsche "Xer" Count-Pattern gefunden
    else if (germanCountMatch) {
      quantityCount = Number.parseInt(germanCountMatch[1], 10);
      unit = 'count';
      // Name ist der Teil nach "Xer"
      name = germanCountMatch[2].trim();
    }
    // Deutsche Zahlwort-Pattern mit Einheit: "zwei scheiben toast"
    else if (germanNumberWordWithUnitMatch) {
      quantityCount = germanNumberWordWithUnitMatch.count;
      unit = germanNumberWordWithUnitMatch.unit;
      name = germanNumberWordWithUnitMatch.remainingName;
    }
    // Deutsche Zahlwort-Pattern gefunden
    else if (germanNumberWordMatch) {
      quantityCount = germanNumberWordMatch.count;
      unit = 'count';
      name = germanNumberWordMatch.remainingName;
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

  /**
   * Versucht deutsche Zahlwörter am Anfang zu erkennen.
   * @returns {count, remainingName} wenn gefunden, sonst null
   */
  private matchGermanNumberWord(
    normalized: string,
  ): { count: number; remainingName: string } | null {
    // Teile den String in Wörter
    const words = normalized.split(/\s+/);

    if (words.length < 2) {
      // Brauchen mindestens ein Zahlwort + Nahrungsmittel
      return null;
    }

    const firstWord = words[0];
    const count = this.germanNumberWords[firstWord];

    if (count !== undefined) {
      // Zahlwort gefunden, Rest ist der Name
      const remainingName = words.slice(1).join(' ');
      return { count, remainingName };
    }

    return null;
  }

  private matchGermanNumberWordWithUnit(
    normalized: string,
  ): { count: number; unit: 'g' | 'piece' | 'slice'; remainingName: string } | null {
    const words = normalized.split(/\s+/);

    if (words.length < 3) {
      return null;
    }

    const count = this.germanNumberWords[words[0]];
    const unit = this.portionUnitAliases[words[1]];

    if (count !== undefined && unit !== undefined) {
      return {
        count,
        unit,
        remainingName: words.slice(2).join(' '),
      };
    }

    return null;
  }
}
