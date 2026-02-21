import { SuggestGoalsUseCase } from '../application/usecases/SuggestGoalsUseCase';
import { UpsertMetabolismProfileUseCase } from '../application/usecases/UpsertMetabolismProfileUseCase';
import { ProfileNotFoundError } from '../application/usecases/ComputeMetabolismResultUseCase';
import { InMemoryMetabolismProfileRepository } from '../infrastructure/InMemoryMetabolismProfileRepository';
import { FixedClock } from '../infrastructure/SystemClock';
import { TestIdGenerator } from '../infrastructure/RandomIdGenerator';

describe('SuggestGoalsUseCase', () => {
  let suggestUseCase: SuggestGoalsUseCase;
  let upsertUseCase: UpsertMetabolismProfileUseCase;
  let repository: InMemoryMetabolismProfileRepository;
  let clock: FixedClock;

  beforeEach(() => {
    repository = new InMemoryMetabolismProfileRepository();
    clock = new FixedClock('2026-02-15T12:00:00Z');
    const idGenerator = new TestIdGenerator();

    suggestUseCase = new SuggestGoalsUseCase(repository, clock);
    upsertUseCase = new UpsertMetabolismProfileUseCase(repository, clock, idGenerator);
  });

  describe('error handling', () => {
    it('should throw ProfileNotFoundError when no profile exists', async () => {
      await expect(suggestUseCase.execute({ strategy: 'balanced' })).rejects.toThrow(
        ProfileNotFoundError,
      );
    });
  });

  describe('balanced strategy', () => {
    it('should suggest balanced goals based on TDEE', async () => {
      await upsertUseCase.execute({
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        sex: 'male',
        activityLevel: 'moderate',
      });

      const suggestion = await suggestUseCase.execute({ strategy: 'balanced' });

      // TDEE should be 2759
      expect(suggestion.goals.calories).toBe(2759);
      expect(suggestion.macroStrategy).toBe('balanced');
      expect(suggestion.rationale).toContain('Balanced');
      expect(suggestion.rationale).toContain('2759');
      expect(suggestion.createdAt).toBe('2026-02-15T12:00:00Z');
    });

    it('should calculate balanced macros (25/45/30)', async () => {
      await upsertUseCase.execute({
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        sex: 'male',
        activityLevel: 'moderate',
      });

      const suggestion = await suggestUseCase.execute({ strategy: 'balanced' });

      // TDEE = 2759
      // Protein: 25% of 2759 = 689.75 / 4 = 172.4375 => 172g
      expect(suggestion.goals.protein).toBe(172);

      // Carbs: 45% of 2759 = 1241.55 / 4 = 310.3875 => 310g
      expect(suggestion.goals.carbs).toBe(310);

      // Fat: 30% of 2759 = 827.7 / 9 = 91.967 => 92g
      expect(suggestion.goals.fat).toBe(92);
    });
  });

  describe('high_protein strategy', () => {
    it('should suggest high protein goals based on TDEE', async () => {
      await upsertUseCase.execute({
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        sex: 'male',
        activityLevel: 'moderate',
      });

      const suggestion = await suggestUseCase.execute({ strategy: 'high_protein' });

      expect(suggestion.goals.calories).toBe(2759);
      expect(suggestion.macroStrategy).toBe('high_protein');
      expect(suggestion.rationale).toContain('High Protein');
      expect(suggestion.rationale).toContain('2759');
    });

    it('should calculate high protein macros (30/40/30)', async () => {
      await upsertUseCase.execute({
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        sex: 'male',
        activityLevel: 'moderate',
      });

      const suggestion = await suggestUseCase.execute({ strategy: 'high_protein' });

      // TDEE = 2759
      // Protein: 30% of 2759 = 827.7 / 4 = 206.925 => 207g
      expect(suggestion.goals.protein).toBe(207);

      // Carbs: 40% of 2759 = 1103.6 / 4 = 275.9 => 276g
      expect(suggestion.goals.carbs).toBe(276);

      // Fat: 30% of 2759 = 827.7 / 9 = 91.967 => 92g
      expect(suggestion.goals.fat).toBe(92);
    });

    it('should have higher protein than balanced strategy', async () => {
      await upsertUseCase.execute({
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        sex: 'male',
        activityLevel: 'moderate',
      });

      const balanced = await suggestUseCase.execute({ strategy: 'balanced' });
      const highProtein = await suggestUseCase.execute({ strategy: 'high_protein' });

      expect(highProtein.goals.protein).toBeGreaterThan(balanced.goals.protein);
      expect(highProtein.goals.carbs).toBeLessThan(balanced.goals.carbs);
    });
  });

  describe('different activity levels', () => {
    it('should suggest lower goals for low activity', async () => {
      await upsertUseCase.execute({
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        sex: 'male',
        activityLevel: 'low',
      });

      const suggestion = await suggestUseCase.execute({ strategy: 'balanced' });

      // BMR = 1780, TDEE = 1780 * 1.2 = 2136
      expect(suggestion.goals.calories).toBe(2136);
    });

    it('should suggest higher goals for high activity', async () => {
      await upsertUseCase.execute({
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        sex: 'male',
        activityLevel: 'high',
      });

      const suggestion = await suggestUseCase.execute({ strategy: 'balanced' });

      // BMR = 1780, TDEE = 1780 * 1.725 = 3070.5 => 3071
      expect(suggestion.goals.calories).toBe(3071);
    });
  });

  describe('different profiles', () => {
    it('should suggest goals for female profile', async () => {
      await upsertUseCase.execute({
        weightKg: 65,
        heightCm: 165,
        ageYears: 28,
        sex: 'female',
        activityLevel: 'moderate',
      });

      const suggestion = await suggestUseCase.execute({ strategy: 'balanced' });

      // BMR = 1380, TDEE = 1380 * 1.55 = 2139
      expect(suggestion.goals.calories).toBe(2139);
    });
  });

  describe('suggestion metadata', () => {
    it('should include complete metadata in suggestion', async () => {
      await upsertUseCase.execute({
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        sex: 'male',
        activityLevel: 'moderate',
      });

      const suggestion = await suggestUseCase.execute({ strategy: 'balanced' });

      expect(suggestion).toHaveProperty('goals');
      expect(suggestion).toHaveProperty('rationale');
      expect(suggestion).toHaveProperty('macroStrategy');
      expect(suggestion).toHaveProperty('createdAt');
      expect(suggestion.createdAt).toBe('2026-02-15T12:00:00Z');
    });
  });
});
