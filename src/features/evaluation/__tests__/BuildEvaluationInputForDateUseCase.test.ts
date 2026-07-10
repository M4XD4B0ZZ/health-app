import {
  BuildEvaluationInputForDateUseCase,
  UnknownProfileSettingsProviderError,
} from '../application/usecases/BuildEvaluationInputForDateUseCase';
import { EvidenceBasedStandardSettingsProvider } from '../application/settingsProviders/EvidenceBasedStandardSettingsProvider';
import { WeightLossSettingsProvider } from '../application/settingsProviders/WeightLossSettingsProvider';
import { EvidenceBasedStandardProfile } from '../application/profiles/EvidenceBasedStandardProfile';
import { WeightLossProfile } from '../application/profiles/WeightLossProfile';
import { GetActiveEvaluationOutputUseCase } from '../application/usecases/GetActiveEvaluationOutputUseCase';
import { PersistedActiveProfileRepository } from '../infrastructure/PersistedActiveProfileRepository';
import { CalorieMacroCorridorRule } from '../application/rules/CalorieMacroCorridorRule';
import { ProteinPreservingDeficitRule } from '../application/rules/ProteinPreservingDeficitRule';
import { InMemoryFoodEntryRepository } from '../../nutrition/infrastructure/repositories/InMemoryFoodEntryRepository';
import { InMemoryEffectiveGoalsRepository } from '../../goals/infrastructure/InMemoryEffectiveGoalsRepository';
import { InMemoryMetabolismProfileRepository } from '../../goals/infrastructure/InMemoryMetabolismProfileRepository';
import { SetEffectiveGoalsUseCase } from '../../goals/application/usecases/SetEffectiveGoalsUseCase';
import { ComputeMetabolismResultUseCase } from '../../goals/application/usecases/ComputeMetabolismResultUseCase';
import { FakeKeyValueStore } from '../../nutrition/infrastructure/storage/FakeKeyValueStore';
import { MetabolismProfile } from '../../goals/domain/models/MetabolismTypes';
import { FoodEntry } from '../../nutrition/domain/models/NutritionTypes';

describe('BuildEvaluationInputForDateUseCase (DI-001)', () => {
  const dateISO = '2026-07-01';
  const fixtureEntry: FoodEntry = {
    id: 'e1',
    rawInput: '200g oats',
    parsedName: 'oats',
    quantityGrams: 200,
    calories: 778,
    protein: 34,
    carbs: 132,
    fat: 14,
    confidenceScore: 0.9,
    sourceType: 'generic',
    createdAt: new Date(`${dateISO}T08:00:00Z`),
  };

  it('assembles a real EvaluationInput and runs it through GetActiveEvaluationOutputUseCase for Evidence-based Standard', async () => {
    const foodEntryRepository = new InMemoryFoodEntryRepository();
    await foodEntryRepository.addEntry(fixtureEntry);

    const effectiveGoalsRepository = new InMemoryEffectiveGoalsRepository();
    const goals = { calories: 2200, protein: 140, carbs: 220, fat: 70 };
    await new SetEffectiveGoalsUseCase(effectiveGoalsRepository).execute({
      mode: 'manual',
      goals,
    });

    const buildInput = new BuildEvaluationInputForDateUseCase(foodEntryRepository, [
      new EvidenceBasedStandardSettingsProvider(effectiveGoalsRepository),
    ]);
    const registry = new PersistedActiveProfileRepository(new FakeKeyValueStore(), [
      EvidenceBasedStandardProfile,
    ]);
    const getOutput = new GetActiveEvaluationOutputUseCase(registry, [CalorieMacroCorridorRule]);

    const input = await buildInput.execute(dateISO, EvidenceBasedStandardProfile.id);
    expect(input.journalReadsForPeriod).toEqual([fixtureEntry]);
    expect(input.foodCatalogReads).toEqual([]);
    expect(input.profileSettings).toEqual({ goals });

    const output = await getOutput.execute(input);
    expect(output.goalProgress.find((g) => g.label === 'calories')?.consumed).toBe(778);
  });

  it('assembles a real EvaluationInput and runs it through GetActiveEvaluationOutputUseCase for Weight Loss', async () => {
    const foodEntryRepository = new InMemoryFoodEntryRepository();
    await foodEntryRepository.addEntry(fixtureEntry);

    const metabolismProfileRepository = new InMemoryMetabolismProfileRepository();
    const fixtureProfile: MetabolismProfile = {
      id: 'profile-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      weightKg: 80,
      heightCm: 180,
      ageYears: 30,
      sex: 'male',
      activityLevel: 'moderate',
    };
    await metabolismProfileRepository.upsert(fixtureProfile);
    const computeMetabolismResultUseCase = new ComputeMetabolismResultUseCase(
      metabolismProfileRepository,
    );
    const expectedTdee = (await computeMetabolismResultUseCase.execute()).tdee;

    const buildInput = new BuildEvaluationInputForDateUseCase(foodEntryRepository, [
      new WeightLossSettingsProvider(computeMetabolismResultUseCase),
    ]);
    const registry = new PersistedActiveProfileRepository(new FakeKeyValueStore(), [
      WeightLossProfile,
    ]);
    const getOutput = new GetActiveEvaluationOutputUseCase(registry, [
      ProteinPreservingDeficitRule,
    ]);

    const input = await buildInput.execute(dateISO, WeightLossProfile.id);
    expect(input.profileSettings).toEqual({ tdee: expectedTdee });

    const output = await getOutput.execute(input);
    expect(output.goalProgress.find((g) => g.label === 'calories')?.consumed).toBe(778);
  });

  it('throws UnknownProfileSettingsProviderError for an unregistered profile id', async () => {
    const buildInput = new BuildEvaluationInputForDateUseCase(
      new InMemoryFoodEntryRepository(),
      [],
    );

    await expect(buildInput.execute(dateISO, 'ghost-profile-id')).rejects.toThrow(
      UnknownProfileSettingsProviderError,
    );
  });
});
