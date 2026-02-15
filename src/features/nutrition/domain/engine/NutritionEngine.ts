import {
  CONFIDENCE_RULES,
  LOW_CONFIDENCE_THRESHOLD,
  DailyNutritionSummary,
  FoodEntry,
  Macros,
  NutritionPer100g,
  NutritionSourceType,
  ParsedInput,
} from '../models/NutritionTypes';
import { ConfidenceMetadata } from '../models/ConfidenceMetadata';

/**
 * Pure Domain Engine für Nutrition-Berechnungen.
 * Keine Side-Effects, keine externen Abhängigkeiten.
 */
export class NutritionEngine {
  public parseRawInput(raw: string): ParsedInput {
    const normalized = raw.trim().toLowerCase();

    const gramsMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*g\b/);
    const quantityGrams = gramsMatch
      ? Number.parseFloat(gramsMatch[1].replace(',', '.'))
      : 100;

    const parsedName = normalized
      .replace(/(\d+(?:[.,]\d+)?)\s*g\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      rawInput: raw,
      parsedName: parsedName.length > 0 ? parsedName : normalized,
      quantityGrams,
      hasExplicitQuantity: Boolean(gramsMatch),
    };
  }

  public calculateFromPer100g(nutritionPer100g: NutritionPer100g, grams: number): Macros {
    const factor = grams / 100;

    return {
      calories: this.round2(nutritionPer100g.calories * factor),
      protein: this.round2(nutritionPer100g.protein * factor),
      carbs: this.round2(nutritionPer100g.carbs * factor),
      fat: this.round2(nutritionPer100g.fat * factor),
    };
  }

  public aggregateDaily(entries: FoodEntry[]): DailyNutritionSummary {
    const totals = entries.reduce(
      (acc, entry) => {
        acc.totalCalories += entry.calories;
        acc.totalProtein += entry.protein;
        acc.totalCarbs += entry.carbs;
        acc.totalFat += entry.fat;
        return acc;
      },
      {
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
      }
    );

    const latestDate = entries.length > 0
      ? new Date(Math.max(...entries.map((e) => e.createdAt.getTime())))
      : new Date();

    return {
      date: latestDate.toISOString().slice(0, 10),
      totalCalories: this.round2(totals.totalCalories),
      totalProtein: this.round2(totals.totalProtein),
      totalCarbs: this.round2(totals.totalCarbs),
      totalFat: this.round2(totals.totalFat),
      entries: [...entries],
    };
  }

  public applyBiasAdjustment(value: number, bias: number): number {
    const clampedBias = this.clamp(bias, -2, 2);
    const multiplier = 1 + clampedBias * 0.05;
    return this.round2(value * multiplier);
  }

  public confidenceForSource(sourceType: NutritionSourceType): number {
    const rule = CONFIDENCE_RULES.find((item) => item.sourceType === sourceType);
    return rule?.score ?? LOW_CONFIDENCE_THRESHOLD;
  }

  public isLowConfidence(confidenceScore: number): boolean {
    return confidenceScore < LOW_CONFIDENCE_THRESHOLD;
  }

  public generateConfidenceMetadata(entry: FoodEntry): ConfidenceMetadata {
    const score = this.confidenceForSource(entry.sourceType);
    let reason: string;

    switch (entry.sourceType) {
      case 'branded':
        reason = 'Exact match found in branded database.';
        break;
      case 'generic':
        reason = 'Exact match found in generic database.';
        break;
      case 'cache':
        reason = 'Data retrieved from cache.';
        break;
      case 'ai':
        reason = 'Estimated by AI model.';
        break;
      case 'user':
        if (entry.quantityGrams > 0) {
          reason = 'Grams provided but nutrition unknown.';
        } else {
          reason = 'User provided data without lookup.';
        }
        break;
      default:
        reason = 'No lookup result found.';
    }

    return {
      score,
      reason,
      sourceType: entry.sourceType,
    };
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}

