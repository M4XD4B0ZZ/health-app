import type {
  AiInterpretationInterpreted,
  ClarificationKind,
  ClarificationRequest,
  InterpretedFoodComponent,
} from '../domain/models/AiInterpretationTypes';

/**
 * Variant C's evidence policy deliberately treats model confidence as weak evidence. A source
 * match can establish food identity, but it cannot validate a quantity or preparation assumption
 * made during interpretation. The thresholds are intentionally conservative and are exercised
 * against frozen fixture observations; they do not affect Variants A or B.
 */
export const VARIANT_C_CONFIDENCE_POLICY_VERSION = 'variant-c-confidence-policy-v1';
export const VARIANT_C_MIN_INTERPRETATION_CONFIDENCE = 0.5;

export interface VariantCConfidenceDecision {
  action: 'continue' | 'clarify';
  clarification?: ClarificationRequest;
  reason: string;
}

const QUANTITY_EVIDENCE =
  /(?:menge|quantity|anzahl|number|größe|groesse|size|becher|portion|stück|stueck|wiederholung|zahl)/i;
const PREPARATION_EVIDENCE = /(?:zubereitung|preparation|gekocht|roh|gebraten)/i;
const BRAND_EVIDENCE = /(?:marke|brand|markenprodukt)/i;

function uncertaintyText(component: InterpretedFoodComponent): string {
  return [...(component.uncertainties ?? []), ...(component.assumptions ?? [])].join(' ');
}

function clarificationKind(component: InterpretedFoodComponent): ClarificationKind {
  const evidence = uncertaintyText(component);
  if (QUANTITY_EVIDENCE.test(evidence)) return 'missing_quantity';
  if (PREPARATION_EVIDENCE.test(evidence)) return 'ambiguous_preparation';
  if (BRAND_EVIDENCE.test(evidence)) return 'missing_brand';
  return 'ambiguous_food_identity';
}

function clarificationFor(
  component: InterpretedFoodComponent,
  kind: ClarificationKind,
): ClarificationRequest {
  const missingInformation: Record<ClarificationKind, string> = {
    missing_quantity: 'Welche Menge bzw. Packungsgröße war es?',
    ambiguous_food_identity: 'Welches Lebensmittel war gemeint?',
    ambiguous_preparation: 'Wie war das Lebensmittel zubereitet?',
    missing_brand: 'Welche Marke bzw. welches konkrete Produkt war es?',
    other: 'Welche Angabe fehlt?',
  };
  return {
    componentId: component.id,
    clarificationKind: kind,
    missingInformation: missingInformation[kind],
  };
}

export function decideVariantCInterpretationConfidence(
  result: AiInterpretationInterpreted,
): VariantCConfidenceDecision {
  const lowestConfidence = result.components.reduce<InterpretedFoodComponent | null>(
    (lowest, component) =>
      !lowest || component.confidence < lowest.confidence ? component : lowest,
    null,
  );

  if (!lowestConfidence) {
    return { action: 'clarify', reason: 'No interpreted component provides identity evidence.' };
  }

  if (
    result.components.length === 1 &&
    lowestConfidence.confidence < VARIANT_C_MIN_INTERPRETATION_CONFIDENCE
  ) {
    return {
      action: 'clarify',
      clarification: clarificationFor(lowestConfidence, clarificationKind(lowestConfidence)),
      reason: `Component confidence ${lowestConfidence.confidence} is below ${VARIANT_C_MIN_INTERPRETATION_CONFIDENCE}.`,
    };
  }

  if (result.outcome === 'interpreted_with_assumptions') {
    const evidenceBearingComponent = result.components.find(
      (component) => (component.uncertainties?.length ?? 0) > 0,
    );
    if (evidenceBearingComponent) {
      const kind = clarificationKind(evidenceBearingComponent);
      if (kind !== 'ambiguous_food_identity') {
        return {
          action: 'clarify',
          clarification: clarificationFor(evidenceBearingComponent, kind),
          reason:
            'The interpretation reports an unresolved assumption that source retrieval cannot validate.',
        };
      }
    }
  }

  return {
    action: 'continue',
    reason: 'Interpretation evidence is sufficient for source retrieval.',
  };
}

export function selectVariantCUnresolvedClarification(
  components: readonly InterpretedFoodComponent[],
): ClarificationRequest | null {
  const component = components.find((candidate) => candidate.interpretedName.trim().length > 0);
  return component ? clarificationFor(component, clarificationKind(component)) : null;
}
