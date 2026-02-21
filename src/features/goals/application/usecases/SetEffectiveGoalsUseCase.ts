import {
  EffectiveGoals,
  GoalsSuggestion,
  DailyGoals,
  GoalsMode,
} from '../../domain/models/GoalsTypes';
import { EffectiveGoalsRepository } from '../ports';

export interface SetEffectiveGoalsInput {
  mode: GoalsMode;
  goals?: DailyGoals;
  suggestion?: GoalsSuggestion;
}

export class SetEffectiveGoalsUseCase {
  constructor(private readonly repository: EffectiveGoalsRepository) {}

  async execute(input: SetEffectiveGoalsInput): Promise<EffectiveGoals> {
    let effectiveGoals: EffectiveGoals;

    if (input.mode === 'suggested') {
      if (!input.suggestion) {
        throw new Error("Suggestion is required when mode is 'suggested'");
      }

      effectiveGoals = {
        mode: 'suggested',
        goals: input.suggestion.goals,
        suggestionSnapshot: input.suggestion,
      };
    } else {
      // manual mode
      if (!input.goals) {
        throw new Error("Goals are required when mode is 'manual'");
      }

      effectiveGoals = {
        mode: 'manual',
        goals: input.goals,
        suggestionSnapshot: undefined,
      };
    }

    await this.repository.upsert(effectiveGoals);
    return effectiveGoals;
  }
}
