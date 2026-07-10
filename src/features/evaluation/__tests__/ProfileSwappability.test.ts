import { GetActiveEvaluationOutputUseCase } from '../application/usecases/GetActiveEvaluationOutputUseCase';
import { PersistedActiveProfileRepository } from '../infrastructure/PersistedActiveProfileRepository';
import { EvidenceBasedStandardProfile } from '../application/profiles/EvidenceBasedStandardProfile';
import { WeightLossProfile } from '../application/profiles/WeightLossProfile';
import { CalorieMacroCorridorRule } from '../application/rules/CalorieMacroCorridorRule';
import { ProteinPreservingDeficitRule } from '../application/rules/ProteinPreservingDeficitRule';
import { EvaluationInput } from '../domain/models';
import { FakeKeyValueStore } from '../../nutrition/infrastructure/storage/FakeKeyValueStore';
import { InMemoryFoodEntryRepository } from '../../nutrition/infrastructure/repositories/InMemoryFoodEntryRepository';
import { FoodEntry } from '../../nutrition/domain/models/NutritionTypes';

/**
 * GE-004 / Product Bible §2a "Variante B": the same Journal day must reinterpret
 * differently under a different active profile, purely by re-running the formula — not by
 * mutating Journal or Food Catalog data. This is proven by test, not just by design.
 */
describe('Profile swappability proves Variante B (GE-004)', () => {
  // Sums to 2000 kcal / 100g protein / 250g carbs / 60g fat.
  const fixtureJournalDay: FoodEntry[] = [
    {
      id: 'e1',
      rawInput: '1200 kcal fixture',
      parsedName: 'fixture-a',
      quantityGrams: 300,
      calories: 1200,
      protein: 60,
      carbs: 150,
      fat: 35,
      confidenceScore: 0.9,
      sourceType: 'branded',
      createdAt: new Date('2026-05-10T08:00:00Z'),
    },
    {
      id: 'e2',
      rawInput: '800 kcal fixture',
      parsedName: 'fixture-b',
      quantityGrams: 200,
      calories: 800,
      protein: 40,
      carbs: 100,
      fat: 25,
      confidenceScore: 0.6,
      sourceType: 'generic',
      createdAt: new Date('2026-05-10T18:00:00Z'),
    },
  ];

  const fixtureInput: EvaluationInput = {
    foodCatalogReads: [],
    journalReadsForPeriod: fixtureJournalDay,
    // A single settings bag serving both profiles' rules — each rule reads only the keys
    // it declared (`goals` vs `tdee`), same as a real orchestrator would assemble it.
    profileSettings: {
      goals: { calories: 2500, protein: 150, carbs: 280, fat: 80 },
      tdee: 1800,
    },
  };

  it('interprets the identical fixture day as on-track under Evidence-based Standard but over under Weight Loss', async () => {
    const keyValueStore = new FakeKeyValueStore();
    const registry = new PersistedActiveProfileRepository(keyValueStore, [
      EvidenceBasedStandardProfile,
      WeightLossProfile,
    ]);
    const useCase = new GetActiveEvaluationOutputUseCase(registry, [
      CalorieMacroCorridorRule,
      ProteinPreservingDeficitRule,
    ]);
    const foodEntryRepository = new InMemoryFoodEntryRepository();
    const addEntrySpy = jest.spyOn(foodEntryRepository, 'addEntry');
    const deleteEntrySpy = jest.spyOn(foodEntryRepository, 'deleteEntry');
    const updateEntrySpy = jest.spyOn(foodEntryRepository, 'updateEntry');

    // Default active profile: Evidence-based Standard (2500 kcal target).
    const standardOutput = await useCase.execute(fixtureInput);
    expect(standardOutput.assessment).toBe('on-track');

    // Switch active profile — a pure read-context change, no Journal/Food Catalog writes.
    await registry.setActiveProfileId(WeightLossProfile.id);

    // Same fixture day, same EvaluationInput, different active profile.
    const weightLossOutput = await useCase.execute(fixtureInput);
    expect(weightLossOutput.assessment).toBe('over');

    // Different assessment for identical underlying facts -- Variante B, proven not assumed.
    expect(standardOutput.assessment).not.toBe(weightLossOutput.assessment);
    expect(standardOutput.goalProgress).not.toEqual(weightLossOutput.goalProgress);

    // No Journal/Food Catalog writes occurred anywhere in this flow.
    expect(addEntrySpy).not.toHaveBeenCalled();
    expect(deleteEntrySpy).not.toHaveBeenCalled();
    expect(updateEntrySpy).not.toHaveBeenCalled();
  });

  it('registry lists both profiles', () => {
    const registry = new PersistedActiveProfileRepository(new FakeKeyValueStore(), [
      EvidenceBasedStandardProfile,
      WeightLossProfile,
    ]);

    expect(registry.list().map((p) => p.id)).toEqual([
      EvidenceBasedStandardProfile.id,
      WeightLossProfile.id,
    ]);
  });
});
