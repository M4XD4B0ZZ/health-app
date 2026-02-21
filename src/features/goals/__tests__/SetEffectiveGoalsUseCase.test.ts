import { SetEffectiveGoalsUseCase } from '../application/usecases/SetEffectiveGoalsUseCase';
import { InMemoryEffectiveGoalsRepository } from '../infrastructure/InMemoryEffectiveGoalsRepository';
import { DailyGoals, GoalsSuggestion } from '../domain/models/GoalsTypes';

describe('SetEffectiveGoalsUseCase', () => {
  let useCase: SetEffectiveGoalsUseCase;
  let repository: InMemoryEffectiveGoalsRepository;

  beforeEach(() => {
    repository = new InMemoryEffectiveGoalsRepository();
    useCase = new SetEffectiveGoalsUseCase(repository);
  });

  describe('manual mode', () => {
    it('should set manual goals without suggestion snapshot', async () => {
      const manualGoals: DailyGoals = {
        calories: 2200,
        protein: 140,
        carbs: 200,
        fat: 70,
      };

      const result = await useCase.execute({
        mode: 'manual',
        goals: manualGoals,
      });

      expect(result.mode).toBe('manual');
      expect(result.goals).toEqual(manualGoals);
      expect(result.suggestionSnapshot).toBeUndefined();

      // Verify persisted
      const stored = await repository.get();
      expect(stored).toEqual(result);
    });

    it('should throw error when goals are missing in manual mode', async () => {
      await expect(
        useCase.execute({
          mode: 'manual',
        }),
      ).rejects.toThrow("Goals are required when mode is 'manual'");
    });
  });

  describe('suggested mode', () => {
    it('should set suggested goals with suggestion snapshot', async () => {
      const suggestion: GoalsSuggestion = {
        goals: {
          calories: 2500,
          protein: 156,
          carbs: 281,
          fat: 83,
        },
        rationale: 'Balanced macro distribution based on TDEE of 2500 kcal/day',
        macroStrategy: 'balanced',
        createdAt: '2026-02-15T12:00:00Z',
      };

      const result = await useCase.execute({
        mode: 'suggested',
        suggestion,
      });

      expect(result.mode).toBe('suggested');
      expect(result.goals).toEqual(suggestion.goals);
      expect(result.suggestionSnapshot).toEqual(suggestion);

      // Verify persisted
      const stored = await repository.get();
      expect(stored).toEqual(result);
    });

    it('should preserve suggestion snapshot even if metabolism changes later', async () => {
      const suggestion: GoalsSuggestion = {
        goals: {
          calories: 2500,
          protein: 156,
          carbs: 281,
          fat: 83,
        },
        rationale: 'Balanced macro distribution based on TDEE of 2500 kcal/day',
        macroStrategy: 'balanced',
        createdAt: '2026-02-15T12:00:00Z',
      };

      await useCase.execute({
        mode: 'suggested',
        suggestion,
      });

      // Verify snapshot is stored
      const stored = await repository.get();
      expect(stored?.suggestionSnapshot).toBeDefined();
      expect(stored?.suggestionSnapshot?.createdAt).toBe('2026-02-15T12:00:00Z');
      expect(stored?.suggestionSnapshot?.macroStrategy).toBe('balanced');
    });

    it('should throw error when suggestion is missing in suggested mode', async () => {
      await expect(
        useCase.execute({
          mode: 'suggested',
        }),
      ).rejects.toThrow("Suggestion is required when mode is 'suggested'");
    });
  });

  describe('snapshot behavior', () => {
    it('should store complete suggestion snapshot including rationale and strategy', async () => {
      const suggestion: GoalsSuggestion = {
        goals: {
          calories: 2759,
          protein: 173,
          carbs: 310,
          fat: 92,
        },
        rationale: 'High Protein macro distribution based on TDEE of 2759 kcal/day',
        macroStrategy: 'high_protein',
        createdAt: '2026-02-15T14:30:00Z',
      };

      await useCase.execute({
        mode: 'suggested',
        suggestion,
      });

      const stored = await repository.get();
      expect(stored?.suggestionSnapshot).toEqual(suggestion);
      expect(stored?.suggestionSnapshot?.rationale).toBe(
        'High Protein macro distribution based on TDEE of 2759 kcal/day',
      );
      expect(stored?.suggestionSnapshot?.macroStrategy).toBe('high_protein');
    });

    it('should not have suggestion snapshot when switching from suggested to manual', async () => {
      // First set suggested goals
      const suggestion: GoalsSuggestion = {
        goals: {
          calories: 2500,
          protein: 156,
          carbs: 281,
          fat: 83,
        },
        rationale: 'Balanced macro distribution based on TDEE of 2500 kcal/day',
        macroStrategy: 'balanced',
        createdAt: '2026-02-15T12:00:00Z',
      };

      await useCase.execute({
        mode: 'suggested',
        suggestion,
      });

      // Then switch to manual
      const manualGoals: DailyGoals = {
        calories: 2200,
        protein: 140,
        carbs: 200,
        fat: 70,
      };

      await useCase.execute({
        mode: 'manual',
        goals: manualGoals,
      });

      const stored = await repository.get();
      expect(stored?.mode).toBe('manual');
      expect(stored?.suggestionSnapshot).toBeUndefined();
    });
  });
});
