import { DailyGoals } from "../../domain/models/GoalsTypes"
import { DailyProgress } from "../../domain/models/ProgressTypes"
import { EffectiveGoalsRepository } from "../ports"
import { calculateDailyProgress } from "../calculators/ProgressCalculator"

export class GoalsNotFoundError extends Error {
  constructor() {
    super("Effective goals not found. Please set goals first.")
    this.name = "GoalsNotFoundError"
  }
}

export interface ComputeDailyProgressInput {
  consumed: DailyGoals
}

export class ComputeDailyProgressUseCase {
  constructor(
    private readonly repository: EffectiveGoalsRepository
  ) {}

  async execute(input: ComputeDailyProgressInput): Promise<DailyProgress> {
    const effectiveGoals = await this.repository.get()

    if (!effectiveGoals) {
      throw new GoalsNotFoundError()
    }

    return calculateDailyProgress(input.consumed, effectiveGoals.goals)
  }
}
