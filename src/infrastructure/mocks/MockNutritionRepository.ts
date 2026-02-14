import { NutritionRepository } from '../../domain/repositories/NutritionRepository';
import { NutritionEntry, DailyNutritionSummary } from '../../domain/models/NutritionEntry';

/**
 * Mock-Implementierung des NutritionRepository mit deterministischen Testdaten
 */
export class MockNutritionRepository implements NutritionRepository {
  // Mock-Daten
  private nutritionEntries: NutritionEntry[] = [
    // Heutige Einträge
    {
      id: 'nutrition-1',
      name: 'Frühstück',
      timestamp: new Date(new Date().setHours(8, 0, 0, 0)),
      calories: 450,
      mealType: 'breakfast',
      proteins: 20,
      carbs: 60,
      fats: 15
    },
    {
      id: 'nutrition-2',
      name: 'Mittagessen',
      timestamp: new Date(new Date().setHours(12, 30, 0, 0)),
      calories: 650,
      mealType: 'lunch',
      proteins: 35,
      carbs: 70,
      fats: 20
    },
    {
      id: 'nutrition-3',
      name: 'Snack',
      timestamp: new Date(new Date().setHours(15, 0, 0, 0)),
      calories: 200,
      mealType: 'snack',
      proteins: 5,
      carbs: 25,
      fats: 8
    },
    {
      id: 'nutrition-4',
      name: 'Abendessen',
      timestamp: new Date(new Date().setHours(19, 0, 0, 0)),
      calories: 550,
      mealType: 'dinner',
      proteins: 30,
      carbs: 45,
      fats: 25
    },
    
    // Gestrige Einträge
    {
      id: 'nutrition-5',
      name: 'Frühstück (gestern)',
      timestamp: new Date(new Date().setHours(8, 0, 0, 0) - 24 * 60 * 60 * 1000),
      calories: 420,
      mealType: 'breakfast',
      proteins: 18,
      carbs: 55,
      fats: 14
    },
    {
      id: 'nutrition-6',
      name: 'Mittagessen (gestern)',
      timestamp: new Date(new Date().setHours(13, 0, 0, 0) - 24 * 60 * 60 * 1000),
      calories: 680,
      mealType: 'lunch',
      proteins: 38,
      carbs: 75,
      fats: 22
    },
    {
      id: 'nutrition-7',
      name: 'Abendessen (gestern)',
      timestamp: new Date(new Date().setHours(19, 30, 0, 0) - 24 * 60 * 60 * 1000),
      calories: 520,
      mealType: 'dinner',
      proteins: 28,
      carbs: 40,
      fats: 22
    }
  ];

  // Einzelne Einträge
  getNutritionEntryById(id: string): NutritionEntry | null {
    return this.nutritionEntries.find(entry => entry.id === id) || null;
  }

  getNutritionEntriesByDate(date: Date): NutritionEntry[] {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    return this.nutritionEntries.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate.getTime() === targetDate.getTime();
    });
  }

  getNutritionEntriesByDateRange(startDate: Date, endDate: Date): NutritionEntry[] {
    return this.nutritionEntries.filter(entry => 
      entry.timestamp >= startDate && entry.timestamp <= endDate
    );
  }

  // Tägliche Zusammenfassungen
  getDailyNutritionSummary(date: Date): DailyNutritionSummary {
    const entries = this.getNutritionEntriesByDate(date);
    
    // Gesamtkalorien berechnen
    const totalCalories = entries.reduce((sum, entry) => sum + entry.calories, 0);
    
    // Makronährstoffe berechnen (falls vorhanden)
    const totalProteins = entries.every(e => e.proteins !== undefined) 
      ? entries.reduce((sum, entry) => sum + (entry.proteins || 0), 0) 
      : undefined;
      
    const totalCarbs = entries.every(e => e.carbs !== undefined) 
      ? entries.reduce((sum, entry) => sum + (entry.carbs || 0), 0) 
      : undefined;
      
    const totalFats = entries.every(e => e.fats !== undefined) 
      ? entries.reduce((sum, entry) => sum + (entry.fats || 0), 0) 
      : undefined;
    
    // Aufschlüsselung nach Mahlzeiten
    const mealBreakdown = {
      breakfast: entries
        .filter(e => e.mealType === 'breakfast')
        .reduce((sum, e) => sum + e.calories, 0),
      lunch: entries
        .filter(e => e.mealType === 'lunch')
        .reduce((sum, e) => sum + e.calories, 0),
      dinner: entries
        .filter(e => e.mealType === 'dinner')
        .reduce((sum, e) => sum + e.calories, 0),
      snacks: entries
        .filter(e => e.mealType === 'snack')
        .reduce((sum, e) => sum + e.calories, 0),
      other: entries
        .filter(e => e.mealType === 'other' || e.mealType === undefined)
        .reduce((sum, e) => sum + e.calories, 0)
    };
    
    return {
      date: new Date(date),
      entries,
      totalCalories,
      totalProteins,
      totalCarbs,
      totalFats,
      mealBreakdown
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
    startDate.setDate(startDate.getDate() - days);
    
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
    const hasCompleteData = summaries.every(s => 
      s.totalProteins !== undefined && 
      s.totalCarbs !== undefined && 
      s.totalFats !== undefined
    );
    
    if (!hasCompleteData || summaries.length === 0) {
      return {
        proteins: null,
        carbs: null,
        fats: null
      };
    }
    
    return {
      proteins: summaries.reduce((sum, day) => sum + (day.totalProteins || 0), 0) / summaries.length,
      carbs: summaries.reduce((sum, day) => sum + (day.totalCarbs || 0), 0) / summaries.length,
      fats: summaries.reduce((sum, day) => sum + (day.totalFats || 0), 0) / summaries.length
    };
  }
}