import { UpsertMetabolismProfileUseCase } from "../application/usecases/UpsertMetabolismProfileUseCase"
import { InMemoryMetabolismProfileRepository } from "../infrastructure/InMemoryMetabolismProfileRepository"
import { FixedClock } from "../infrastructure/SystemClock"
import { TestIdGenerator } from "../infrastructure/RandomIdGenerator"

describe("UpsertMetabolismProfileUseCase", () => {
  let useCase: UpsertMetabolismProfileUseCase
  let repository: InMemoryMetabolismProfileRepository
  let clock: FixedClock
  let idGenerator: TestIdGenerator

  beforeEach(() => {
    repository = new InMemoryMetabolismProfileRepository()
    clock = new FixedClock("2026-02-15T12:00:00Z")
    idGenerator = new TestIdGenerator()
    idGenerator.reset()
    useCase = new UpsertMetabolismProfileUseCase(repository, clock, idGenerator)
  })

  describe("create new profile", () => {
    it("should create new profile when none exists", async () => {
      const result = await useCase.execute({
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        sex: "male",
        activityLevel: "moderate",
      })

      expect(result.id).toBe("test-id-0")
      expect(result.createdAt).toBe("2026-02-15T12:00:00Z")
      expect(result.updatedAt).toBe("2026-02-15T12:00:00Z")
      expect(result.weightKg).toBe(80)
      expect(result.heightCm).toBe(180)
      expect(result.ageYears).toBe(30)
      expect(result.sex).toBe("male")
      expect(result.activityLevel).toBe("moderate")
      expect(result.activityLevelSource).toBe("manual")
    })

    it("should use provided activityLevelSource", async () => {
      const result = await useCase.execute({
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        sex: "male",
        activityLevel: "high",
        activityLevelSource: "auto",
      })

      expect(result.activityLevelSource).toBe("auto")
    })

    it("should default activityLevelSource to manual when not provided", async () => {
      const result = await useCase.execute({
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        sex: "male",
        activityLevel: "high",
      })

      expect(result.activityLevelSource).toBe("manual")
    })
  })

  describe("update existing profile", () => {
    it("should preserve id and createdAt when updating", async () => {
      // Create initial profile
      const first = await useCase.execute({
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        sex: "male",
        activityLevel: "moderate",
      })

      // Update clock
      clock = new FixedClock("2026-02-16T14:00:00Z")
      useCase = new UpsertMetabolismProfileUseCase(repository, clock, idGenerator)

      // Update profile
      const updated = await useCase.execute({
        weightKg: 82,
        heightCm: 180,
        ageYears: 30,
        sex: "male",
        activityLevel: "high",
      })

      expect(updated.id).toBe(first.id) // Same ID
      expect(updated.createdAt).toBe(first.createdAt) // Preserved
      expect(updated.updatedAt).toBe("2026-02-16T14:00:00Z") // New timestamp
      expect(updated.weightKg).toBe(82) // Updated
      expect(updated.activityLevel).toBe("high") // Updated
    })

    it("should update all fields except id and createdAt", async () => {
      await useCase.execute({
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        sex: "male",
        activityLevel: "moderate",
      })

      clock = new FixedClock("2026-02-17T10:00:00Z")
      useCase = new UpsertMetabolismProfileUseCase(repository, clock, idGenerator)

      const updated = await useCase.execute({
        weightKg: 75,
        heightCm: 175,
        ageYears: 31,
        sex: "female",
        activityLevel: "low",
        activityLevelSource: "auto",
      })

      expect(updated.weightKg).toBe(75)
      expect(updated.heightCm).toBe(175)
      expect(updated.ageYears).toBe(31)
      expect(updated.sex).toBe("female")
      expect(updated.activityLevel).toBe("low")
      expect(updated.activityLevelSource).toBe("auto")
    })
  })

  describe("persistence", () => {
    it("should persist profile to repository", async () => {
      await useCase.execute({
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        sex: "male",
        activityLevel: "moderate",
      })

      const stored = await repository.get()
      expect(stored).toBeDefined()
      expect(stored?.weightKg).toBe(80)
    })

    it("should overwrite previous profile on update", async () => {
      await useCase.execute({
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        sex: "male",
        activityLevel: "moderate",
      })

      await useCase.execute({
        weightKg: 85,
        heightCm: 180,
        ageYears: 30,
        sex: "male",
        activityLevel: "high",
      })

      const stored = await repository.get()
      expect(stored?.weightKg).toBe(85)
      expect(stored?.activityLevel).toBe("high")
    })
  })
})
