import { ParsedInput } from '../domain/ParsedInput';
import { FoodMatch } from '../domain/FoodMatch';
import { ConfidenceScore } from '../domain/ConfidenceScore';
import { InputInterpretation } from '../domain/InputInterpretation';

import { matchDish } from './matchDish';

export function buildInputInterpretation(
  parsed: ParsedInput,
  matches: FoodMatch[],
  confidence: ConfidenceScore,
): InputInterpretation {
  const itemCount = parsed.items.length;

  // Prüfe, ob der gesamte Rohinput ein bekanntes Gericht ist
  const dishMatch = matchDish(parsed.raw);

  let type: 'single_item' | 'multi_item' | 'unknown' | 'dish';
  let summary: string;

  if (dishMatch.status === 'matched') {
    type = 'dish';
    summary = 'dish_detected';
  } else if (itemCount === 1) {
    type = 'single_item';
    summary = 'single_item_detected';
  } else if (itemCount > 1) {
    type = 'multi_item';
    summary = 'multiple_items_detected';
  } else {
    type = 'unknown';
    summary = 'no_items_detected';
  }

  return {
    type,
    itemCount,
    confidenceLevel: confidence.level,
    summary,
  };
}
