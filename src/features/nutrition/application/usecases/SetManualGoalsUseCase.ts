import { GoalsRepository } from '../ports/GoalsRepository';
import { ActivityLevel } from '../../domain/goals/ActivityLevel';
import { UserGoals } from '../../domain/goals/UserGoals';

export interface SetManualGoalsInput {
  caloriesTargetKcal: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  activityLevel: ActivityLevel;
}

export interface SetManualGoalsResult {
  status: 'applied' | 'rejected';
  reasonCodes: string[];
  explanationDe: string;
  goals?: UserGoals;
}

function impliedCalories(goals: SetManualGoalsInput): number {
  return goals.proteinTargetG * 4 + goals.carbsTargetG * 4 + goals.fatTargetG * 9;
}

export class SetManualGoalsUseCase {
  constructor(private readonly goalsRepository: GoalsRepository) {}

  async execute(input: SetManualGoalsInput): Promise<SetManualGoalsResult> {
    const reasonCodes: string[] = [];

    if (input.caloriesTargetKcal < 800 || input.caloriesTargetKcal > 6000) {
      reasonCodes.push('CALORIES_OUT_OF_RANGE');
    }

    if (input.proteinTargetG < 0 || input.proteinTargetG > 400) {
      reasonCodes.push('PROTEIN_OUT_OF_RANGE');
    }
    if (input.fatTargetG < 0 || input.fatTargetG > 250) {
      reasonCodes.push('FAT_OUT_OF_RANGE');
    }
    if (input.carbsTargetG < 0 || input.carbsTargetG > 800) {
      reasonCodes.push('CARBS_OUT_OF_RANGE');
    }

    if (reasonCodes.length > 0) {
      return {
        status: 'rejected',
        reasonCodes,
        explanationDe: 'Ziele konnten wegen ungültiger Eingaben nicht gespeichert werden.',
      };
    }

    const implied = impliedCalories(input);
    const deviation =
      Math.abs(implied - input.caloriesTargetKcal) / Math.max(1, input.caloriesTargetKcal);
    if (deviation > 0.15) {
      reasonCodes.push('MACROS_CAL_MISMATCH');
    }

    const goals: UserGoals = {
      caloriesTargetKcal: Math.round(input.caloriesTargetKcal),
      proteinTargetG: Math.round(input.proteinTargetG),
      carbsTargetG: Math.round(input.carbsTargetG),
      fatTargetG: Math.round(input.fatTargetG),
      activityLevel: input.activityLevel,
      source: 'manual',
      updatedAt: new Date().toISOString(),
    };

    await this.goalsRepository.setGoals(goals);

    return {
      status: 'applied',
      reasonCodes,
      explanationDe: reasonCodes.includes('MACROS_CAL_MISMATCH')
        ? 'Ziele gespeichert, aber Makro-Kalorien weichen vom Kalorienziel ab.'
        : 'Manuelle Ziele gespeichert.',
      goals,
    };
  }
}
