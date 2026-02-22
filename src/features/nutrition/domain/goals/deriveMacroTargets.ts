export interface DeriveMacroTargetsInput {
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
}

export interface DeriveMacroTargetsResult {
  carbsG: number;
  valid: boolean;
  reasonCodes: string[];
}

export function deriveMacroTargets(input: DeriveMacroTargetsInput): DeriveMacroTargetsResult {
  const reasonCodes: string[] = [];
  const remainingCalories = input.caloriesKcal - (input.proteinG * 4 + input.fatG * 9);
  if (remainingCalories < 0) {
    reasonCodes.push('NEGATIVE_REMAINING_CALORIES');
    return {
      carbsG: 0,
      valid: false,
      reasonCodes,
    };
  }

  return {
    carbsG: Math.max(0, Math.round(remainingCalories / 4)),
    valid: true,
    reasonCodes,
  };
}
