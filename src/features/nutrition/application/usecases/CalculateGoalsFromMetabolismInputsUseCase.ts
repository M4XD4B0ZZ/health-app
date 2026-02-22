import { deriveMacroTargets } from '../../domain/goals/deriveMacroTargets';
import { UserGoals } from '../../domain/goals/UserGoals';
import { calculateMetabolismBreakdown } from '../../domain/metabolism/MetabolismCalculator';
import { MetabolismBreakdown } from '../../domain/metabolism/MetabolismBreakdown';
import { MetabolismInputs } from '../../domain/metabolism/MetabolismInputs';

export interface MacroPreferences {
  proteinG?: number;
  fatG?: number;
  carbsG?: number;
}

export interface CalculateGoalsResult {
  suggestedGoals: UserGoals;
  metabolismBreakdown: MetabolismBreakdown;
}

export class CalculateGoalsFromMetabolismInputsUseCase {
  execute(inputs: MetabolismInputs, macroPreferences?: MacroPreferences): CalculateGoalsResult {
    const metabolismBreakdown = calculateMetabolismBreakdown(inputs);
    const calories = metabolismBreakdown.tdeeKcal;

    const hasAllManualMacros =
      macroPreferences?.proteinG !== undefined &&
      macroPreferences?.fatG !== undefined &&
      macroPreferences?.carbsG !== undefined;

    let proteinTargetG: number;
    let fatTargetG: number;
    let carbsTargetG: number;

    if (hasAllManualMacros) {
      proteinTargetG = Math.round(macroPreferences!.proteinG!);
      fatTargetG = Math.round(macroPreferences!.fatG!);
      carbsTargetG = Math.round(macroPreferences!.carbsG!);
    } else if (macroPreferences?.proteinG !== undefined && macroPreferences?.fatG !== undefined) {
      proteinTargetG = Math.round(macroPreferences.proteinG);
      fatTargetG = Math.round(macroPreferences.fatG);
      const carbs = deriveMacroTargets({
        caloriesKcal: calories,
        proteinG: proteinTargetG,
        fatG: fatTargetG,
      });
      carbsTargetG = carbs.carbsG;
    } else {
      // Deterministic default split: 25% protein, 25% fat, rest carbs.
      proteinTargetG = Math.round((calories * 0.25) / 4);
      fatTargetG = Math.round((calories * 0.25) / 9);
      const carbs = deriveMacroTargets({
        caloriesKcal: calories,
        proteinG: proteinTargetG,
        fatG: fatTargetG,
      });
      carbsTargetG = carbs.carbsG;
    }

    return {
      suggestedGoals: {
        caloriesTargetKcal: calories,
        proteinTargetG,
        carbsTargetG,
        fatTargetG,
        activityLevel: inputs.activityLevel,
        updatedAt: new Date().toISOString(),
        source: 'calculated',
      },
      metabolismBreakdown,
    };
  }
}
