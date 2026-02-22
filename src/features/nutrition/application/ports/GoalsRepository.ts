import { UserGoals } from '../../domain/goals/UserGoals';

export interface GoalsRepository {
  getGoals(): Promise<UserGoals | null>;
  setGoals(goals: UserGoals): Promise<void>;
}
