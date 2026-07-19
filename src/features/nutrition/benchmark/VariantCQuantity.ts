import { InterpretedFoodComponent } from '../domain/models/AiInterpretationTypes';
import { resolvePortionGrams } from '../domain/portion/resolvePortionGrams';
import { QuantityAssumption } from './VariantCTypes';

/**
 * RESOLVER-V3-005: deterministic quantity -> grams conversion for one interpreted component.
 * Reuses the existing production portion model (`resolvePortionGrams`, which itself reuses
 * `PortionKnowledgeService`/`SEED_PORTION_HINTS`/`detectCanonicalEntity`'s default portions) --
 * no new universal gram weights are invented here (spec: "erfinde keine universellen Gewichte
 * ohne Provenienz"). Every non-`g` conversion is either backed by an existing, provenance-carrying
 * portion hint, or explicitly reported as not responsibly convertible in this spike.
 */

export interface ComponentGramsResolution {
  status: 'resolved' | 'not_convertible';
  grams: number | null;
  assumptions: QuantityAssumption[];
  warnings: string[];
}

/** Maps a household-measure phrase to the existing `PortionHintUnit` vocabulary ('piece'|'slice')
 * -- a small, documented text heuristic (not a new universal weight), since
 * `InterpretedQuantity.unit` itself has no 'slice' value (spec's `AiInterpretationTypes.ts`
 * vocabulary is coarser: 'g'|'ml'|'piece'|'portion'). */
function derivePortionHintUnit(component: InterpretedFoodComponent): 'piece' | 'slice' {
  const measure = component.quantity.householdMeasure?.toLowerCase() ?? '';
  if (measure.includes('scheibe')) return 'slice';
  return 'piece';
}

export async function resolveComponentGrams(
  component: InterpretedFoodComponent,
): Promise<ComponentGramsResolution> {
  const { quantity } = component;

  if (quantity.unit === 'g' && quantity.value !== undefined && quantity.value > 0) {
    return { status: 'resolved', grams: quantity.value, assumptions: [], warnings: [] };
  }

  if (quantity.unit === 'piece') {
    const portionUnit = derivePortionHintUnit(component);
    const resolution = await resolvePortionGrams(component.interpretedName, 0, quantity.value, {
      unit: portionUnit,
      rawInput: component.originalSegment,
    });

    if (resolution.status === 'resolved') {
      const assumptions: QuantityAssumption[] =
        resolution.reasonCode === 'EXPLICIT_GRAMS'
          ? []
          : [
              {
                reasonCode: resolution.reasonCode,
                note: `Grams derived from an existing, provenance-carrying portion hint (${resolution.reasonCode}), not an invented weight.`,
                gramsPerUnit: resolution.gramsPerUnit,
              },
            ];
      return { status: 'resolved', grams: resolution.grams, assumptions, warnings: [] };
    }

    return {
      status: 'not_convertible',
      grams: null,
      assumptions: [],
      warnings: [
        `No known portion hint for "${component.interpretedName}" (unit=${portionUnit}) -- ` +
          'a responsible gram conversion is not possible in this spike; clarification would be ' +
          'the correct product behavior rather than an invented weight.',
      ],
    };
  }

  if (quantity.unit === 'ml') {
    return {
      status: 'not_convertible',
      grams: null,
      assumptions: [],
      warnings: [
        `Quantity unit "ml" for "${component.interpretedName}" has no provenance-backed ` +
          'density/gram-equivalent model in this spike (no invented 1 ml ≈ 1 g assumption) -- ' +
          'reported as not convertible rather than guessed.',
      ],
    };
  }

  return {
    status: 'not_convertible',
    grams: null,
    assumptions: [],
    warnings: [
      `Component "${component.interpretedName}" has no numeric quantity or known portion hint ` +
        `(portionDescription="${quantity.portionDescription ?? 'none'}") -- not convertible without ` +
        'an invented weight.',
    ],
  };
}
