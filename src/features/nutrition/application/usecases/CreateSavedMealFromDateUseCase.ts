import { FoodEntry } from '../../domain/models/NutritionTypes';
import { SavedMealTemplate, SavedMealItem } from '../../domain/models/SavedMealTypes';
import { FoodEntryRepository } from '../ports/FoodEntryRepository';
import { SavedMealRepository } from '../ports/SavedMealRepository';
import { Clock } from '../ports/Clock';
import { IdGenerator } from '../ports/IdGenerator';
import { PERSONAL_RESOLUTION_MEMORY_RECORDING_CONTRACT_VERSION } from '../../domain/models/PersonalResolutionMemoryRecording';
import { RecordPersonalResolutionMemoryUseCase } from './RecordPersonalResolutionMemoryUseCase';
import type { ResolverObservationOwnerProvider } from '../ports/ResolverObservationOwnerProvider';

/**
 * SM-007: `quantityGrams` only reflects an explicit gram amount typed by the user
 * (e.g. "200g Magerquark"). Count/unit-based entries (e.g. "2 Eier") resolve their actual
 * weight via portion knowledge into `entry.grams` instead — `quantityGrams` stays 0 for
 * them. Using `quantityGrams` alone as the "has a real weight" signal silently dropped
 * every piece-based entry from a template. `entry.grams` is populated for both cases and is
 * the same value already shown to the user (e.g. "2 Stück (120 g)"), so it's the correct
 * single source of truth here.
 */
function resolvedGrams(entry: FoodEntry): number {
  return entry.quantityGrams > 0 ? entry.quantityGrams : (entry.grams ?? 0);
}

/**
 * Use-Case: Create Saved Meal Template from Date
 *
 * Nimmt alle FoodEntries von einem bestimmten Datum und erstellt
 * daraus eine SavedMealTemplate. Entries ohne Gramm-Angaben werden übersprungen.
 */
export class CreateSavedMealFromDateUseCase {
  constructor(
    private readonly foodEntryRepository: FoodEntryRepository,
    private readonly savedMealRepository: SavedMealRepository,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    /**
     * RESOLVER-V3-026: naming a meal template from real entries and saving it is exactly the
     * Decision Record's `deliberately_saved_personal_meal` P2 signal — a deliberate, named user
     * action, not an inferred one. Optional and best-effort so this use case's core behavior
     * never depends on private-memory recording succeeding.
     */
    private readonly recordPersonalResolutionMemoryUseCase?: RecordPersonalResolutionMemoryUseCase,
    private readonly personalResolutionMemoryOwnerProvider?: ResolverObservationOwnerProvider,
  ) {}

  async execute(dateISO: string, name: string): Promise<SavedMealTemplate> {
    // Load all FoodEntries for the given date
    const entries = await this.foodEntryRepository.listEntriesForDate(dateISO);

    // Create template items, skipping entries without a resolved weight
    const items: SavedMealItem[] = entries
      .filter((entry) => resolvedGrams(entry) > 0)
      .map((entry) => {
        const grams = resolvedGrams(entry);

        // SM-002: derive a frozen per-100g snapshot so log-back can compute macros
        // deterministically without re-resolving the food by name or by catalog identity.
        const factor = 100 / grams;
        const per100g =
          entry.calories > 0
            ? {
                calories: entry.calories * factor,
                protein: entry.protein * factor,
                carbs: entry.carbs * factor,
                fat: entry.fat * factor,
              }
            : undefined;

        return {
          parsedName: entry.parsedName,
          quantityGrams: grams,
          // SM-001: preserve the source entry's Food Catalog identity, if any, so log-back
          // can display/trace it back — the actual determinism for macros comes from
          // per100g (SM-002) below.
          ...(entry.foodCatalogRef ? { foodCatalogRef: entry.foodCatalogRef } : {}),
          ...(per100g ? { per100g } : {}),
        };
      });

    // Generate new template
    const now = this.clock.now();
    const template: SavedMealTemplate = {
      id: this.idGenerator.newId(),
      name,
      items,
      createdAt: now,
      updatedAt: now,
    };

    // Persist template
    await this.savedMealRepository.create(template);

    void this.recordSavedMealMemory(template).catch(() => {});

    return template;
  }

  /** Best-effort, never blocks or fails template creation itself. */
  private async recordSavedMealMemory(template: SavedMealTemplate): Promise<void> {
    if (!this.recordPersonalResolutionMemoryUseCase || !this.personalResolutionMemoryOwnerProvider)
      return;
    const ownerId = await this.personalResolutionMemoryOwnerProvider.getOwnerId();
    if (!ownerId) return;

    const occurredAt = this.clock.now().toISOString();
    const sourceGroundedItems = template.items.filter((item) => item.foodCatalogRef);

    await Promise.all(
      sourceGroundedItems.map((item, index) =>
        this.recordPersonalResolutionMemoryUseCase!.execute({
          contractVersion: PERSONAL_RESOLUTION_MEMORY_RECORDING_CONTRACT_VERSION,
          ownerId,
          actionId: `${template.id}:${index}`,
          locale: 'de',
          target: {
            sourceType: item.foodCatalogRef!.source,
            sourceId: item.foodCatalogRef!.sourceId,
            kind: 'source_grounded',
          },
          evidenceType: 'deliberately_saved_personal_meal',
          occurredAt,
        }).catch(() => undefined),
      ),
    );
  }
}
