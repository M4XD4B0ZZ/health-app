import { DecisionMeta } from '../../../domain/models/DecisionMeta';
import { PortionParseResult } from '../../../domain/portion/PortionParseResult';
import { NutritionTotalsBreakdown } from '../../../domain/portion/computeTotals';

export function buildEditDecisionMeta(input: {
  editText: string;
  portionParseResult: PortionParseResult;
  ingredientEditUnsupported?: boolean;
  calcBreakdown?: NutritionTotalsBreakdown;
  createdAt?: string;
}): DecisionMeta {
  const reasonCodes = [...input.portionParseResult.notes];
  const details: string[] = [`Edit: "${input.editText}".`];
  let status: DecisionMeta['status'] = 'rejected';
  let confidence = input.portionParseResult.confidence;
  let explanation = 'Änderung konnte nicht sicher angewendet werden.';

  if (input.portionParseResult.grams !== undefined) {
    status = 'applied';
    reasonCodes.push('GRAMS_SET');
    explanation = `Menge erkannt: ${input.portionParseResult.grams} g.`;
    details.push(`Menge erkannt: ${input.portionParseResult.grams} g.`);
  } else if (input.portionParseResult.multiplier !== undefined) {
    status = 'applied';
    reasonCodes.push('MULTIPLIER_SET');
    explanation = `Portion angepasst: ${input.portionParseResult.multiplier}x.`;
    details.push(`Portion angepasst: ${input.portionParseResult.multiplier}x.`);
  } else if (input.portionParseResult.notes.includes('ML_UNSUPPORTED')) {
    status = 'ambiguous';
    explanation = 'Volumen erkannt (ml), aber ohne Dichte nicht sicher in Gramm umrechenbar.';
  } else if (input.portionParseResult.status === 'ambiguous') {
    status = 'ambiguous';
    explanation = 'Mehrdeutige Angabe erkannt, bitte präzisieren.';
  }

  if (input.ingredientEditUnsupported) {
    status = 'ambiguous';
    reasonCodes.push('INGREDIENT_EDIT_UNSUPPORTED');
    explanation = 'Zutaten-Änderung erkannt, aber aktuell nicht deterministisch unterstützt.';
    details.push('Zutaten-Edit erkannt: exclude: oil.');
    confidence = Math.min(confidence, 0.55);
  }

  if (input.calcBreakdown) {
    details.push(
      `Neu berechnet: ${input.calcBreakdown.per100g.calories} kcal/100g -> ${input.calcBreakdown.totals.calories} kcal.`,
    );
  }

  return {
    status,
    confidence,
    reasonCodes: Array.from(new Set(reasonCodes)),
    explanation,
    details: Array.from(new Set(details)).slice(0, 5),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}
