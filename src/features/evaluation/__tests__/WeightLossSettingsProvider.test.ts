import { WeightLossSettingsProvider } from '../application/settingsProviders/WeightLossSettingsProvider';
import { InMemoryMetabolismProfileRepository } from '../../goals/infrastructure/InMemoryMetabolismProfileRepository';
import {
  ComputeMetabolismResultUseCase,
  ProfileNotFoundError,
} from '../../goals/application/usecases/ComputeMetabolismResultUseCase';
import { WeightLossProfile } from '../application/profiles/WeightLossProfile';
import { MetabolismProfile } from '../../goals/domain/models/MetabolismTypes';

describe('WeightLossSettingsProvider (DI-001)', () => {
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

  it('builds { tdee } from the real ComputeMetabolismResultUseCase', async () => {
    const repository = new InMemoryMetabolismProfileRepository();
    await repository.upsert(fixtureProfile);
    const computeMetabolismResultUseCase = new ComputeMetabolismResultUseCase(repository);
    const expected = await computeMetabolismResultUseCase.execute();

    const provider = new WeightLossSettingsProvider(computeMetabolismResultUseCase);

    expect(provider.profileId).toBe(WeightLossProfile.id);
    expect(await provider.build('2026-07-01')).toEqual({ tdee: expected.tdee });
  });

  it('throws ProfileNotFoundError when no metabolism profile is set', async () => {
    const provider = new WeightLossSettingsProvider(
      new ComputeMetabolismResultUseCase(new InMemoryMetabolismProfileRepository()),
    );

    await expect(provider.build('2026-07-01')).rejects.toThrow(ProfileNotFoundError);
  });
});
