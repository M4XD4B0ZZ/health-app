import { ProfileSettingsProvider } from '../ports/ProfileSettingsProvider';
import { EffectiveGoalsRepository, GoalsNotFoundError } from '../../../goals';
import { EvidenceBasedStandardProfile } from '../profiles/EvidenceBasedStandardProfile';

/**
 * DI-001: builds `CalorieMacroCorridorRule`'s settings (see `CalorieMacroCorridorSettings`)
 * from the real, already screen-wired `EffectiveGoalsRepository` (`src/features/goals`) —
 * no new goals concept introduced. Return type matches the `ProfileSettingsProvider`
 * contract's `Record<string, unknown>` rather than the Rule-specific settings interface —
 * the Rule itself is what narrows it back via a cast (see `CalorieMacroCorridorRule`).
 */
export class EvidenceBasedStandardSettingsProvider implements ProfileSettingsProvider {
  readonly profileId = EvidenceBasedStandardProfile.id;

  constructor(private readonly effectiveGoalsRepository: EffectiveGoalsRepository) {}

  async build(_dateISO: string): Promise<Record<string, unknown>> {
    const effectiveGoals = await this.effectiveGoalsRepository.get();
    if (!effectiveGoals) {
      throw new GoalsNotFoundError();
    }
    return { goals: effectiveGoals.goals };
  }
}
