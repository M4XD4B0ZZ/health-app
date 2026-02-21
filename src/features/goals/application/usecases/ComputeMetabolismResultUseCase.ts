import { MetabolismResult } from '../../domain/models/MetabolismTypes';
import { MetabolismProfileRepository } from '../ports';
import { calculateBmr, calculateTdee } from '../calculators/MetabolismCalculator';

export class ProfileNotFoundError extends Error {
  constructor() {
    super('Metabolism profile not found. Please create a profile first.');
    this.name = 'ProfileNotFoundError';
  }
}

export class ComputeMetabolismResultUseCase {
  constructor(private readonly repository: MetabolismProfileRepository) {}

  async execute(): Promise<MetabolismResult> {
    const profile = await this.repository.get();

    if (!profile) {
      throw new ProfileNotFoundError();
    }

    // Calculate BMR
    const { bmr, steps: bmrSteps } = calculateBmr(profile);

    // Calculate TDEE
    const { tdee, steps: tdeeSteps } = calculateTdee(profile, bmr);

    // Combine steps in correct order:
    // 1) bmr_formula
    // 2) bmr_substitution
    // 3) activity_multiplier
    // 4) tdee_result
    const steps = [...bmrSteps, ...tdeeSteps];

    return {
      bmr,
      tdee,
      steps,
    };
  }
}
