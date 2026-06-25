import type { PortionHintUnit } from './PortionHint';

export type PortionNeedsEditReasonCode = 'COUNT_WITHOUT_PORTION_HINT';

export type PortionSuggestionSource = 'generic_fallback' | 'seed' | 'research' | 'none';

export interface PortionNeedsEditItem {
  type: 'portion_needs_edit';
  reasonCode: PortionNeedsEditReasonCode;
  rawInput: string;
  rawFoodName: string;
  displayName: string;
  foodIdentityKey: string | null;
  unit: PortionHintUnit;
  quantity: number;
  suggestedGramsPerUnit?: number;
  suggestionSource?: PortionSuggestionSource;
  message: string;
}

export function buildPortionNeedsEditItem(args: {
  reasonCode: PortionNeedsEditReasonCode;
  rawInput: string;
  rawFoodName: string;
  displayName?: string;
  foodIdentityKey: string | null;
  unit: PortionHintUnit;
  quantity: number;
  suggestedGramsPerUnit?: number;
  suggestionSource?: PortionSuggestionSource;
}): PortionNeedsEditItem {
  const displayName = args.displayName ?? args.rawFoodName;

  return {
    type: 'portion_needs_edit',
    reasonCode: args.reasonCode,
    rawInput: args.rawInput,
    rawFoodName: args.rawFoodName,
    displayName,
    foodIdentityKey: args.foodIdentityKey,
    unit: args.unit,
    quantity: args.quantity,
    suggestedGramsPerUnit: args.suggestedGramsPerUnit,
    suggestionSource: args.suggestionSource,
    message: `Ich kenne das Stückgewicht für ${displayName} noch nicht. Schätzen?`,
  };
}