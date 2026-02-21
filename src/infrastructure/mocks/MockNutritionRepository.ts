import { NutritionRepository } from '../../domain/repositories/NutritionRepository';
import { NutritionEntry, DailyNutritionSummary } from '../../domain/models/NutritionEntry';
import { TimeRange } from '../../domain/models/TimeRange';

/**
 * Mock-Implementierung des NutritionRepository mit deterministischen Testdaten
 */
export class MockNutritionRepository implements NutritionRepository {
  private readonly DAY_MS = 24 * 60 * 60 * 1000;

  private nutritionEntries: NutritionEntry[] = [];

  constructor() {
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));

    const presets = [
      { calories: 460, proteins: 22, carbs: 58, fats: 16 },
      { calories: 640, proteins: 36, carbs: 72, fats: 19 },
      { calories: 210, proteins: 6, carbs: 24, fats: 9 },
      { calories: 560, proteins: 31, carbs: 48, fats: 24 },
      { calories: 430, proteins: 19, carbs: 52, fats: 15 },
      { calories: 670, proteins: 39, carbs: 75, fats: 21 },
      { calories: 520, proteins: 29, carbs: 41, fats: 22 },
    ];

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const day = new Date(today.getTime() - dayOffset * this.DAY_MS);
      const p1 = presets[dayOffset % presets.length];
      const p2 = presets[(dayOffset + 1) % presets.length];
      const p3 = presets[(dayOffset + 2) % presets.length];

      this.nutritionEntries.push(
        {
          id: `nutrition-${dayOffset}-breakfast`,
          name: dayOffset === 0 ? 'Frühstück' : `Frühstück (${dayOffset} Tage her)`,
          timestamp: new Date(new Date(day).setHours(8, 0, 0, 0)),
          calories: p1.calories,
          mealType: 'breakfast',
          proteins: p1.proteins,
          carbs: p1.carbs,
          fats: p1.fats,
        },
        {
          id: `nutrition-${dayOffset}-lunch`,
          name: dayOffset === 0 ? 'Mittagessen' : `Mittagessen (${dayOffset} Tage her)`,
          timestamp: new Date(new Date(day).setHours(12, 30, 0, 0)),
          calories: p2.calories,
          mealType: 'lunch',
          proteins: p2.proteins,
          carbs: p2.carbs,
          fats: p2.fats,
        },
        {
          id: `nutrition-${dayOffset}-dinner`,
          name: dayOffset === 0 ? 'Abendessen' : `Abendessen (${dayOffset} Tage her)`,
          timestamp: new Date(new Date(day).setHours(19, 0, 0, 0)),
          calories: p3.calories,
          mealType: 'dinner',
          proteins: p3.proteins,
          carbs: p3.carbs,
          fats: p3.fats,
        },
      );
    }
  }

  getEntries(range: TimeRange): NutritionEntry[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (range === 'today') {
      return this.getNutritionEntriesByDate(today);
    }

    const startDate = new Date(today.getTime() - 6 * this.DAY_MS);
    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);

    return this.getNutritionEntriesByDateRange(startDate, endDate);
  }

  getTotalCalories(range: TimeRange): number {
    return this.getEntries(range).reduce((sum, entry) => sum + entry.calories, 0);
  }

  // Einzelne Einträge
  getNutritionEntryById(id: string): NutritionEntry | null {
    return this.nutritionEntries.find((entry) => entry.id === id) || null;
  }

  getNutritionEntriesByDate(date: Date): NutritionEntry[] {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    return this.nutritionEntries.filter((entry) => {
      const entryDate = new Date(entry.timestamp);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate.getTime() === targetDate.getTime();
    });
  }

  getNutritionEntriesByDateRange(startDate: Date, endDate: Date): NutritionEntry[] {
    return this.nutritionEntries.filter(
      (entry) => entry.timestamp >= startDate && entry.timestamp <= endDate,
    );
  }

  // Tägliche Zusammenfassungen
  getDailyNutritionSummary(date: Date): DailyNutritionSummary {
    const entries = this.getNutritionEntriesByDate(date);

    // Gesamtkalorien berechnen
    const totalCalories = entries.reduce((sum, entry) => sum + entry.calories, 0);

    // Makronährstoffe berechnen (falls vorhanden)
    const totalProteins = entries.every((e) => e.proteins !== undefined)
      ? entries.reduce((sum, entry) => sum + (entry.proteins || 0), 0)
      : undefined;

    const totalCarbs = entries.every((e) => e.carbs !== undefined)
      ? entries.reduce((sum, entry) => sum + (entry.carbs || 0), 0)
      : undefined;

    const totalFats = entries.every((e) => e.fats !== undefined)
      ? entries.reduce((sum, entry) => sum + (entry.fats || 0), 0)
      : undefined;

    // Aufschlüsselung nach Mahlzeiten
    const mealBreakdown = {
      breakfast: entries
        .filter((e) => e.mealType === 'breakfast')
        .reduce((sum, e) => sum + e.calories, 0),
      lunch: entries.filter((e) => e.mealType === 'lunch').reduce((sum, e) => sum + e.calories, 0),
      dinner: entries
        .filter((e) => e.mealType === 'dinner')
        .reduce((sum, e) => sum + e.calories, 0),
      snacks: entries.filter((e) => e.mealType === 'snack').reduce((sum, e) => sum + e.calories, 0),
      other: entries
        .filter((e) => e.mealType === 'other' || e.mealType === undefined)
        .reduce((sum, e) => sum + e.calories, 0),
    };

    return {
      date: new Date(date),
      entries,
      totalCalories,
      totalProteins,
      totalCarbs,
      totalFats,
      mealBreakdown,
    };
  }

  getDailyNutritionSummaries(startDate: Date, endDate: Date): DailyNutritionSummary[] {
    const result: DailyNutritionSummary[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      result.push(this.getDailyNutritionSummary(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }

  // Statistiken
  getAverageCaloriesPerDay(days: number): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (days - 1));

    const summaries = this.getDailyNutritionSummaries(startDate, today);

    return summaries.reduce((sum, day) => sum + day.totalCalories, 0) / summaries.length;
  }

  getAverageMacronutrients(days: number): {
    proteins: number | null;
    carbs: number | null;
    fats: number | null;
  } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days);

    const summaries = this.getDailyNutritionSummaries(startDate, today);

    // Prüfen, ob alle Tage Makronährstoffdaten haben
    const hasCompleteData = summaries.every(
      (s) =>
        s.totalProteins !== undefined && s.totalCarbs !== undefined && s.totalFats !== undefined,
    );

    if (!hasCompleteData || summaries.length === 0) {
      return {
        proteins: null,
        carbs: null,
        fats: null,
      };
    }

    return {
      proteins:
        summaries.reduce((sum, day) => sum + (day.totalProteins || 0), 0) / summaries.length,
      carbs: summaries.reduce((sum, day) => sum + (day.totalCarbs || 0), 0) / summaries.length,
      fats: summaries.reduce((sum, day) => sum + (day.totalFats || 0), 0) / summaries.length,
    };
  }
}
