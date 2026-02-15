import { ComputeDailyProgressUseCase, GoalsNotFoundError } from "../application/usecases/ComputeDailyProgressUseCase"
import { SetEffectiveGoalsUseCase } from "../application/usecases/SetEffectiveGoalsUseCase"
import { InMemoryEffectiveGoalsRepository } from "../infrastructure/InMemoryEffectiveGoalsRepository"
import { DailyGoals } from "../domain/models/GoalsTypes"

describe("ComputeDailyProgressUseCase", () => {
  let computeProgressUseCase: ComputeDailyProgressUseCase
  let setGoalsUseCase: SetEffectiveGoalsUseCase
  let repository: InMemoryEffectiveGoalsRepository

  beforeEach(() => {
    repository = new InMemoryEffectiveGoalsRepository()
    computeProgressUseCase = new ComputeDailyProgressUseCase(repository)
    setGoalsUseCase = new SetEffectiveGoalsUseCase(repository)
  })

  describe("error handling", () => {
    it("should throw GoalsNotFoundError when no goals are set", async () => {
      const consumed: DailyGoals = {
        calories: 1500,
        protein: 100,
        carbs: 150,
        fat: 50,
      }

      await expect(
        computeProgressUseCase.execute({ consumed })
      ).rejects.toThrow(GoalsNotFoundError)

      await expect(
        computeProgressUseCase.execute({ consumed })
      ).rejects.toThrow("Effective goals not found. Please set goals first.")
    })
  })

  describe("progress calculation", () => {
    beforeEach(async () => {
      // Set up goals
      await setGoalsUseCase.execute({
        mode: "manual",
        goals: {
          calories: 2500,
          protein: 150,
          carbs: 250,
          fat: 80,
        },
      })
    })

    it("should calculate progress when under goals", async () => {
      const progress = await computeProgressUseCase.execute({
        consumed: {
          calories: 1500,
          protein: 100,
          carbs: 150,
          fat: 50,
        },
      })

      expect(progress.consumedCalories).toBe(1500)
      expect(progress.remainingCalories).toBe(1000)
      expect(progress.proteinConsumed).toBe(100)
      expect(progress.proteinRemaining).toBe(50)
      expect(progress.carbsConsumed).toBe(150)
      expect(progress.carbsRemaining).toBe(100)
      expect(progress.fatConsumed).toBe(50)
      expect(progress.fatRemaining).toBe(30)

      expect(progress.isOverCalories).toBe(false)
      expect(progress.isOverProtein).toBe(false)
      expect(progress.isOverCarbs).toBe(false)
      expect(progress.isOverFat).toBe(false)
    })

    it("should calculate progress when over goals", async () => {
      const progress = await computeProgressUseCase.execute({
        consumed: {
          calories: 2700,
          protein: 160,
          carbs: 270,
          fat: 90,
        },
      })

      expect(progress.remainingCalories).toBe(0)
      expect(progress.proteinRemaining).toBe(0)
      expect(progress.carbsRemaining).toBe(0)
      expect(progress.fatRemaining).toBe(0)

      expect(progress.isOverCalories).toBe(true)
      expect(progress.isOverProtein).toBe(true)
      expect(progress.isOverCarbs).toBe(true)
      expect(progress.isOverFat).toBe(true)
    })

    it("should handle exact match", async () => {
      const progress = await computeProgressUseCase.execute({
        consumed: {
          calories: 2500,
          protein: 150,
          carbs: 250,
          fat: 80,
        },
      })

      expect(progress.remainingCalories).toBe(0)
      expect(progress.proteinRemaining).toBe(0)
      expect(progress.carbsRemaining).toBe(0)
      expect(progress.fatRemaining).toBe(0)

      expect(progress.isOverCalories).toBe(false)
      expect(progress.isOverProtein).toBe(false)
      expect(progress.isOverCarbs).toBe(false)
      expect(progress.isOverFat).toBe(false)
    })

    it("should handle zero consumption", async () => {
      const progress = await computeProgressUseCase.execute({
        consumed: {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        },
      })

      expect(progress.remainingCalories).toBe(2500)
      expect(progress.proteinRemaining).toBe(150)
      expect(progress.carbsRemaining).toBe(250)
      expect(progress.fatRemaining).toBe(80)

      expect(progress.isOverCalories).toBe(false)
      expect(progress.isOverProtein).toBe(false)
      expect(progress.isOverCarbs).toBe(false)
      expect(progress.isOverFat).toBe(false)
    })
  })

  describe("with different goal sources", () => {
    it("should work with manually set goals", async () => {
      await setGoalsUseCase.execute({
        mode: "manual",
        goals: {
          calories: 2200,
          protein: 140,
          carbs: 200,
          fat: 70,
        },
      })

      const progress = await computeProgressUseCase.execute({
        consumed: {
          calories: 1800,
          protein: 120,
          carbs: 180,
          fat: 60,
        },
      })

      expect(progress.remainingCalories).toBe(400)
      expect(progress.proteinRemaining).toBe(20)
    })

    it("should work with suggested goals", async () => {
      await setGoalsUseCase.execute({
        mode: "suggested",
        suggestion: {
          goals: {
            calories: 2759,
            protein: 172,
            carbs: 310,
            fat: 92,
          },
          rationale: "Balanced macro distribution based on TDEE of 2759 kcal/day",
          macroStrategy: "balanced",
          createdAt: "2026-02-15T12:00:00Z",
        },
      })

      const progress = await computeProgressUseCase.execute({
        consumed: {
          calories: 2000,
          protein: 150,
          carbs: 250,
          fat: 80,
        },
      })

      expect(progress.remainingCalories).toBe(759)
      expect(progress.proteinRemaining).toBe(22)
      expect(progress.carbsRemaining).toBe(60)
      expect(progress.fatRemaining).toBe(12)
    })
  })
})
