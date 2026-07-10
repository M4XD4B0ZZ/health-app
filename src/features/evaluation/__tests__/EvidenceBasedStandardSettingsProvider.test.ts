import { EvidenceBasedStandardSettingsProvider } from '../application/settingsProviders/EvidenceBasedStandardSettingsProvider';
import { InMemoryEffectiveGoalsRepository } from '../../goals/infrastructure/InMemoryEffectiveGoalsRepository';
import { SetEffectiveGoalsUseCase } from '../../goals/application/usecases/SetEffectiveGoalsUseCase';
import { GoalsNotFoundError } from '../../goals/application/usecases/ComputeDailyProgressUseCase';
import { EvidenceBasedStandardProfile } from '../application/profiles/EvidenceBasedStandardProfile';

describe('EvidenceBasedStandardSettingsProvider (DI-001)', () => {
  it('builds { goals } from the real EffectiveGoalsRepository', async () => {
    const repository = new InMemoryEffectiveGoalsRepository();
    const goals = { calories: 2200, protein: 140, carbs: 220, fat: 70 };
    await new SetEffectiveGoalsUseCase(repository).execute({ mode: 'manual', goals });

    const provider = new EvidenceBasedStandardSettingsProvider(repository);

    expect(provider.profileId).toBe(EvidenceBasedStandardProfile.id);
    expect(await provider.build('2026-07-01')).toEqual({ goals });
  });

  it('throws GoalsNotFoundError when no effective goals are set', async () => {
    const provider = new EvidenceBasedStandardSettingsProvider(
      new InMemoryEffectiveGoalsRepository(),
    );

    await expect(provider.build('2026-07-01')).rejects.toThrow(GoalsNotFoundError);
  });
});
