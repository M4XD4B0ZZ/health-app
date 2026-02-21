/**
 * Input Complexity Detector
 *
 * Erkennt, ob ein Roheingabe-String komplex genug ist, um AI-Parsing zu benötigen.
 * Deterministisches Parsing wird bevorzugt - AI nur für komplexe Multi-Item-Inputs.
 */

/**
 * Prüft, ob der Input komplex ist und AI-Parsing benötigt.
 *
 * Regeln:
 * - Enthält Konnektoren: "mit", "und", "+", "&"
 * - Enthält Kommas mit mindestens 2 Teilen
 * - Enthält mehrere Food-Tokens mit Konnektoren
 *
 * Wichtig: "20er nuggets" oder "10er" allein sind NICHT komplex.
 * Dies sind Mengenangaben, die deterministisch geparst werden.
 *
 * @param raw - Der rohe Input-String
 * @returns true wenn komplex, false wenn einfach
 */
export function isComplexMealInput(raw: string): boolean {
  const normalized = raw.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  // Regel 1: Enthält deutsche Konnektoren "mit" oder "und"
  if (normalized.includes(' mit ') || normalized.includes(' und ')) {
    return true;
  }

  // Regel 2: Enthält mathematische Konnektoren "+" oder "&"
  if (normalized.includes('+') || normalized.includes('&')) {
    return true;
  }

  // Regel 3: Enthält Kommas und splittet in >= 2 nicht-leere Teile
  if (normalized.includes(',')) {
    const parts = normalized
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (parts.length >= 2) {
      return true;
    }
  }

  // Nicht komplex
  return false;
}
