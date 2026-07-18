import {
  GetActiveEvaluationOutputUseCase,
  UnknownEvaluationProfileError,
  UnknownRuleError,
} from '../application/usecases/GetActiveEvaluationOutputUseCase';
import { EvaluationProfileRegistry } from '../application/ports/EvaluationProfileRegistry';
import { PersistedActiveProfileRepository } from '../infrastructure/PersistedActiveProfileRepository';
import { EvidenceBasedStandardProfile } from '../application/profiles/EvidenceBasedStandardProfile';
import { CalorieMacroCorridorRule } from '../application/rules/CalorieMacroCorridorRule';
import { EvaluationInput } from '../domain/models';
import { FakeKeyValueStore } from '../../nutrition/infrastructure/storage/FakeKeyValueStore';

describe('GetActiveEvaluationOutputUseCase (GE-003)', () => {
  const fixtureInput: EvaluationInput = {
    foodCatalogReads: [],
    journalReadsForPeriod: [
      {
        id: 'e1',
        rawInput: '100g oats',
        parsedName: 'oats',
        quantityGrams: 100,
        calories: 400,
        protein: 15,
        carbs: 60,
        fat: 8,
        confidenceScore: 0.9,
        sourceType: 'generic',
        createdAt: new Date('2026-05-01T08:00:00Z'),
      },
    ],
    profileSettings: { goals: { calories: 2000, protein: 120, carbs: 200, fat: 70 } },
  };

  it('runs the active profile’s rules and returns a merged EvaluationOutput', async () => {
    const registry = new PersistedActiveProfileRepository(new FakeKeyValueStore(), [
      EvidenceBasedStandardProfile,
    ]);
    const useCase = new GetActiveEvaluationOutputUseCase(registry, [CalorieMacroCorridorRule]);

    const output = await useCase.execute(fixtureInput);

    expect(output.assessment).toBe('below');
    expect(output.goalProgress).toHaveLength(4);
    expect(output.goalProgress.find((g) => g.label === 'calories')?.consumed).toBe(400);
  });

  it('throws UnknownEvaluationProfileError when the registry’s active id matches no listed profile', async () => {
    const brokenRegistry: EvaluationProfileRegistry = {
      list: () => [EvidenceBasedStandardProfile],
      getActiveProfileId: async () => 'ghost-profile-id',
      setActiveProfileId: async () => {},
    };
    const useCase = new GetActiveEvaluationOutputUseCase(brokenRegistry, [
      CalorieMacroCorridorRule,
    ]);

    await expect(useCase.execute(fixtureInput)).rejects.toThrow(UnknownEvaluationProfileError);
  });

  it('throws UnknownRuleError when the active profile references a rule not in knownRules', async () => {
    const registry = new PersistedActiveProfileRepository(new FakeKeyValueStore(), [
      EvidenceBasedStandardProfile,
    ]);
    const useCase = new GetActiveEvaluationOutputUseCase(registry, []); // no rules known

    await expect(useCase.execute(fixtureInput)).rejects.toThrow(UnknownRuleError);
  });
});
