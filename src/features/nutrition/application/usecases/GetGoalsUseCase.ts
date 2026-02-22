import { GoalsRepository } from '../ports/GoalsRepository';
import { UserGoals } from '../../domain/goals/UserGoals';

export class GetGoalsUseCase {
  constructor(private readonly goalsRepository: GoalsRepository) {}

  async execute(): Promise<UserGoals | null> {
    return this.goalsRepository.getGoals();
  }
}
