import { GoalsSuggestion } from '../../domain/models/GoalsTypes';
import { MetabolismProfileRepository, Clock } from '../ports';
import { ComputeMetabolismResultUseCase } from './ComputeMetabolismResultUseCase';
import { suggestDailyGoals, MacroStrategy } from '../calculators/GoalsSuggestionCalculator';

export interface SuggestGoalsInput {
  strategy: MacroStrategy;
}

export class SuggestGoalsUseCase {
  constructor(
    private readonly metabolismRepo: MetabolismProfileRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SuggestGoalsInput): Promise<GoalsSuggestion> {
    // Compute metabolism (TDEE)
    const computeMetabolism = new ComputeMetabolismResultUseCase(this.metabolismRepo);
    const metabolismResult = await computeMetabolism.execute();

    // Suggest goals based on TDEE
    const goals = suggestDailyGoals(metabolismResult.tdee, input.strategy);

    // Create rationale
    const strategyName = input.strategy === 'balanced' ? 'Balanced' : 'High Protein';
    const rationale = `${strategyName} macro distribution based on TDEE of ${metabolismResult.tdee} kcal/day`;

    return {
      goals,
      rationale,
      macroStrategy: input.strategy,
      createdAt: this.clock.nowISO(),
    };
  }
}
