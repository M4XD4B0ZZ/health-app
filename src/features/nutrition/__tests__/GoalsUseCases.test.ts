import { CalculateGoalsFromMetabolismInputsUseCase } from '../application/usecases/CalculateGoalsFromMetabolismInputsUseCase';
import { GetGoalsUseCase } from '../application/usecases/GetGoalsUseCase';
import { SetManualGoalsUseCase } from '../application/usecases/SetManualGoalsUseCase';
import { GoalsRepository } from '../application/ports/GoalsRepository';
import { UserGoals } from '../domain/goals/UserGoals';

class InMemoryGoalsRepository implements GoalsRepository {
  private value: UserGoals | null = null;

  async getGoals(): Promise<UserGoals | null> {
    return this.value;
  }

  async setGoals(goals: UserGoals): Promise<void> {
    this.value = goals;
  }
}

describe('Goals use cases', () => {
  it('calculate suggestion returns breakdown and calculated goals', () => {
    const useCase = new CalculateGoalsFromMetabolismInputsUseCase();
    const result = useCase.execute({
      sex: 'male',
      ageYears: 30,
      heightCm: 180,
      weightKg: 80,
      activityLevel: 'moderate',
    });

    expect(result.suggestedGoals.source).toBe('calculated');
    expect(result.suggestedGoals.caloriesTargetKcal).toBe(2759);
    expect(result.metabolismBreakdown.formula).toBe('mifflin_st_jeor');
    expect(result.metabolismBreakdown.detailLinesDe.length).toBeGreaterThanOrEqual(2);
  });

  it('set manual goals validates and persists', async () => {
    const repository = new InMemoryGoalsRepository();
    const setUseCase = new SetManualGoalsUseCase(repository);
    const getUseCase = new GetGoalsUseCase(repository);

    const result = await setUseCase.execute({
      caloriesTargetKcal: 2500,
      proteinTargetG: 170,
      carbsTargetG: 280,
      fatTargetG: 70,
      activityLevel: 'moderate',
    });

    expect(result.status).toBe('applied');
    const stored = await getUseCase.execute();
    expect(stored?.caloriesTargetKcal).toBe(2500);
  });

  it('mismatch warning emits reason code', async () => {
    const repository = new InMemoryGoalsRepository();
    const setUseCase = new SetManualGoalsUseCase(repository);

    const result = await setUseCase.execute({
      caloriesTargetKcal: 2000,
      proteinTargetG: 300,
      carbsTargetG: 50,
      fatTargetG: 120,
      activityLevel: 'low',
    });

    expect(result.status).toBe('applied');
    expect(result.reasonCodes).toContain('MACROS_CAL_MISMATCH');
  });
});
