import { ComputeMetabolismResultUseCase, ProfileNotFoundError } from "../application/usecases/ComputeMetabolismResultUseCase"
import { UpsertMetabolismProfileUseCase } from "../application/usecases/UpsertMetabolismProfileUseCase"
import { InMemoryMetabolismProfileRepository } from "../infrastructure/InMemoryMetabolismProfileRepository"
import { FixedClock } from "../infrastructure/SystemClock"
import { TestIdGenerator } from "../infrastructure/RandomIdGenerator"

describe("ComputeMetabolismResultUseCase", () => {
  let computeUseCase: ComputeMetabolismResultUseCase
  let upsertUseCase: UpsertMetabolismProfileUseCase
  let repository: InMemoryMetabolismProfileRepository

  beforeEach(() => {
    repository = new InMemoryMetabolismProfileRepository()
    const clock = new FixedClock("2026-02-15T12:00:00Z")
    const idGenerator = new TestIdGenerator()

    computeUseCase = new ComputeMetabolismResultUseCase(repository)
    upsertUseCase = new UpsertMetabolismProfileUseCase(repository, clock, idGenerator)
  })

  describe("error handling", () => {
    it("should throw ProfileNotFoundError when no profile exists", async () => {
      await expect(computeUseCase.execute()).rejects.toThrow(ProfileNotFoundError)
      await expect(computeUseCase.execute()).rejects.toThrow(
        "Metabolism profile not found. Please create a profile first."
      )
    })
  })

  describe("metabolism calculation", () => {
    it("should compute BMR and TDEE for male", async () => {
      await upsertUseCase.execute({
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        sex: "male",
        activityLevel: "moderate",
      })

      const result = await computeUseCase.execute()

      // BMR: 10*80 + 6.25*180 - 5*30 + 5 = 1780
      expect(result.bmr).toBe(1780)

      // TDEE: 1780 * 1.55 = 2759
      expect(result.tdee).toBe(2759)
    })

    it("should compute BMR and TDEE for female", async () => {
      await upsertUseCase.execute({
        weightKg: 65,
        heightCm: 165,
        ageYears: 28,
        sex: "female",
        activityLevel: "low",
      })

      const result = await computeUseCase.execute()

      // BMR: 10*65 + 6.25*165 - 5*28 - 161 = 1380
      expect(result.bmr).toBe(1380)

      // TDEE: 1380 * 1.2 = 1656
      expect(result.tdee).toBe(1656)
    })
  })

  describe("breakdown steps", () => {
    it("should return steps in correct order", async () => {
      await upsertUseCase.execute({
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        sex: "male",
        activityLevel: "moderate",
      })

      const result = await computeUseCase.execute()

      expect(result.steps).toHaveLength(4)
      expect(result.steps[0].key).toBe("bmr_formula")
      expect(result.steps[1].key).toBe("bmr_substitution")
      expect(result.steps[2].key).toBe("activity_multiplier")
      expect(result.steps[3].key).toBe("tdee_result")
    })

    it("should include formula, substituted, and result in each step", async () => {
      await upsertUseCase.execute({
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        sex: "male",
        activityLevel: "high",
      })

      const result = await computeUseCase.execute()

      const bmrStep = result.steps[1]
      expect(bmrStep.formula).toBeTruthy()
      expect(bmrStep.substituted).toContain("80")
      expect(bmrStep.substituted).toContain("180")
      expect(bmrStep.substituted).toContain("30")
      expect(bmrStep.result).toBe(1780)

      const activityStep = result.steps[2]
      expect(activityStep.substituted).toContain("1780")
      expect(activityStep.substituted).toContain("1.725")
    })
  })
})
