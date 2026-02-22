import { DecisionMeta } from '../../../domain/models/DecisionMeta';
import { ResolverDecision } from '../../../domain/models/ResolverDecision';
import { PortionParseResult } from '../../../domain/portion/PortionParseResult';
import { NutritionTotalsBreakdown } from '../../../domain/portion/computeTotals';

export function buildLogDecisionMeta(input: {
  resolverDecision?: ResolverDecision;
  portionParseResult?: PortionParseResult;
  calcBreakdown?: NutritionTotalsBreakdown;
  createdAt?: string;
}): DecisionMeta {
  const reasonCodes: string[] = [];
  const details: string[] = [];
  let status: DecisionMeta['status'] = 'rejected';
  let confidence = 0.35;
  let explanation = 'Keine sichere Zuordnung oder Mengenangabe erkannt.';

  if (input.resolverDecision) {
    reasonCodes.push(...input.resolverDecision.reasonCodes);
    if (input.resolverDecision.best) {
      confidence = Math.max(confidence, input.resolverDecision.best.score);
      details.push(
        `Quelle: ${input.resolverDecision.best.source} (Score ${input.resolverDecision.best.score.toFixed(2)}).`,
      );
    }

    if (input.resolverDecision.status === 'accepted') {
      status = 'applied';
      if (input.resolverDecision.best) {
        explanation = `Lebensmittel eindeutig zugeordnet (${input.resolverDecision.best.source}, Score ${input.resolverDecision.best.score.toFixed(2)}).`;
      } else {
        explanation = 'Lebensmittel eindeutig zugeordnet.';
      }
    } else if (input.resolverDecision.status === 'ambiguous') {
      status = 'ambiguous';
      explanation = 'Mehrere mögliche Treffer, bitte prüfen.';
    } else {
      status = 'rejected';
      explanation = 'Lebensmittel konnte nicht sicher zugeordnet werden.';
    }
  }

  if (input.portionParseResult) {
    reasonCodes.push(...input.portionParseResult.notes);
    confidence = Math.max(confidence, input.portionParseResult.confidence);
    if (input.portionParseResult.grams !== undefined) {
      details.push(`Menge erkannt: ${input.portionParseResult.grams} g.`);
      if (status !== 'ambiguous') {
        status = 'applied';
      }
      explanation = `Menge erkannt: ${input.portionParseResult.grams} g.`;
    } else if (input.portionParseResult.multiplier !== undefined) {
      details.push(`Portion angepasst: ${input.portionParseResult.multiplier}x.`);
      if (status !== 'ambiguous') {
        status = 'applied';
      }
      explanation = `Portion angepasst: ${input.portionParseResult.multiplier}x.`;
    } else if (input.portionParseResult.notes.includes('ML_UNSUPPORTED')) {
      status = 'ambiguous';
      explanation = 'Volumen erkannt (ml), aber ohne Dichte nicht sicher in Gramm umrechenbar.';
    }
  }

  if (input.calcBreakdown) {
    details.push(
      `Berechnung: ${input.calcBreakdown.per100g.calories} kcal/100g -> ${input.calcBreakdown.totals.calories} kcal.`,
    );
  }

  const uniqueReasons = Array.from(new Set(reasonCodes));
  const uniqueDetails = Array.from(new Set(details)).slice(0, 5);

  return {
    status,
    confidence,
    reasonCodes: uniqueReasons,
    explanation,
    details: uniqueDetails.length > 0 ? uniqueDetails : undefined,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}
