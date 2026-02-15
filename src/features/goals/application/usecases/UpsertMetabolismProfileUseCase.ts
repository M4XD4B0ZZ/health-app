import { MetabolismProfile, ActivityLevel, ActivityLevelSource, Sex } from "../../domain/models/MetabolismTypes"
import { MetabolismProfileRepository, Clock, IdGenerator } from "../ports"

export interface UpsertMetabolismProfileInput {
  weightKg: number
  heightCm: number
  ageYears: number
  sex: Sex
  activityLevel: ActivityLevel
  activityLevelSource?: ActivityLevelSource
}

export class UpsertMetabolismProfileUseCase {
  constructor(
    private readonly repository: MetabolismProfileRepository,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator
  ) {}

  async execute(input: UpsertMetabolismProfileInput): Promise<MetabolismProfile> {
    const existing = await this.repository.get()
    const now = this.clock.nowISO()

    let profile: MetabolismProfile

    if (existing) {
      // Update existing profile, preserve id and createdAt
      profile = {
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: now,
        weightKg: input.weightKg,
        heightCm: input.heightCm,
        ageYears: input.ageYears,
        sex: input.sex,
        activityLevel: input.activityLevel,
        activityLevelSource: input.activityLevelSource ?? "manual",
      }
    } else {
      // Create new profile
      profile = {
        id: this.idGenerator.newId(),
        createdAt: now,
        updatedAt: now,
        weightKg: input.weightKg,
        heightCm: input.heightCm,
        ageYears: input.ageYears,
        sex: input.sex,
        activityLevel: input.activityLevel,
        activityLevelSource: input.activityLevelSource ?? "manual",
      }
    }

    await this.repository.upsert(profile)
    return profile
  }
}
