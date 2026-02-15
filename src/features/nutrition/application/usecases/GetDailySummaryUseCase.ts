import { DailyNutritionSummary } from '../../domain/models/NutritionTypes';
import { FoodEntryRepository } from '../ports/FoodEntryRepository';
import { NutritionEngine } from '../../domain/engine/NutritionEngine';

/**
 * Use-Case: Get Daily Summary
 * 
 * Lädt alle Einträge für ein Datum und aggregiert sie zu einer Tages-Zusammenfassung.
 */
export class GetDailySummaryUseCase {
  constructor(
    private readonly repository: FoodEntryRepository,
    private readonly engine: NutritionEngine
  ) {}

  async execute(dateISO: string): Promise<DailyNutritionSummary> {
    // Lade alle Einträge für das Datum
    const entries = await this.repository.listEntriesForDate(dateISO);

    // Aggregiere via Domain Engine
    const summary = this.engine.aggregateDaily(entries);

    // Überschreibe das Datum mit dem angeforderten (falls keine Entries vorhanden)
    return {
      ...summary,
      date: dateISO,
    };
  }
}
