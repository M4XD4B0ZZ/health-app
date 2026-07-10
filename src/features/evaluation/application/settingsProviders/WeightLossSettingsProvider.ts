import { ProfileSettingsProvider } from '../ports/ProfileSettingsProvider';
import { ComputeMetabolismResultUseCase } from '../../../goals';
import { WeightLossProfile } from '../profiles/WeightLossProfile';

/**
 * DI-001: builds `ProteinPreservingDeficitRule`'s settings (see
 * `ProteinPreservingDeficitSettings`) from the real, unmodified
 * `ComputeMetabolismResultUseCase` (`src/features/goals`) — its own `ProfileNotFoundError`
 * surfaces when no `MetabolismProfile` has been set, same as it already does for
 * `GoalsScreen.tsx` today.
 */
export class WeightLossSettingsProvider implements ProfileSettingsProvider {
  readonly profileId = WeightLossProfile.id;

  constructor(private readonly computeMetabolismResultUseCase: ComputeMetabolismResultUseCase) {}

  async build(_dateISO: string): Promise<Record<string, unknown>> {
    const { tdee } = await this.computeMetabolismResultUseCase.execute();
    return { tdee };
  }
}
