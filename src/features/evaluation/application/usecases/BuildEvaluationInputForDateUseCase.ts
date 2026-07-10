import { EvaluationInput } from '../../domain/models';
import { ProfileSettingsProvider } from '../ports/ProfileSettingsProvider';
import { FoodEntryRepository } from '../../../nutrition/application/ports/FoodEntryRepository';

export class UnknownProfileSettingsProviderError extends Error {
  constructor(profileId: string) {
    super(`No ProfileSettingsProvider registered for profile id: ${profileId}`);
    this.name = 'UnknownProfileSettingsProviderError';
  }
}

/**
 * DI-001: assembles a real `EvaluationInput` for a given date — `journalReadsForPeriod`
 * from the real `FoodEntryRepository`, `profileSettings` delegated to whichever
 * `ProfileSettingsProvider` matches the active profile id. Never hardcodes per-profile
 * knowledge itself; adding a new Profile only means registering one more provider.
 * `foodCatalogReads` stays empty — no current Rule declares a data need for it.
 */
export class BuildEvaluationInputForDateUseCase {
  constructor(
    private readonly foodEntryRepository: FoodEntryRepository,
    private readonly settingsProviders: ProfileSettingsProvider[],
  ) {}

  async execute(dateISO: string, activeProfileId: string): Promise<EvaluationInput> {
    const provider = this.settingsProviders.find((p) => p.profileId === activeProfileId);
    if (!provider) {
      throw new UnknownProfileSettingsProviderError(activeProfileId);
    }

    const [journalReadsForPeriod, profileSettings] = await Promise.all([
      this.foodEntryRepository.listEntriesForDate(dateISO),
      provider.build(dateISO),
    ]);

    return {
      foodCatalogReads: [],
      journalReadsForPeriod,
      profileSettings,
    };
  }
}
