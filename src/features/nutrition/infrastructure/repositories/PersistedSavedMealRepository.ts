import { SavedMealTemplate, SavedMealItem } from '../../domain/models/SavedMealTypes';
import { SavedMealRepository } from '../../application/ports/SavedMealRepository';
import { KeyValueStore } from '../../application/ports/KeyValueStore';
import { FoodSourceType } from '../../domain/catalog/FoodCatalogSource';
import { isUuidV4 } from '../../../../infrastructure/ids/isUuidV4';
import { assignMissingUuids } from '../../../../infrastructure/ids/assignMissingUuids';

/**
 * Serialisierbare Version von SavedMealItem für JSON-Speicherung.
 */
interface SerializedSavedMealItem {
  parsedName: string;
  quantityGrams: number;
  foodCatalogRef?: {
    source: FoodSourceType;
    sourceId: string;
    displayName: string;
    confidence: number;
  };
  per100g?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

/**
 * Serialisierbare Version von SavedMealTemplate für JSON-Speicherung.
 * Date-Objekte werden als ISO-Strings gespeichert.
 */
interface SerializedSavedMealTemplate {
  id: string;
  name: string;
  items: SerializedSavedMealItem[];
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  deletedAt?: string; // ISO string
}

/**
 * SM-004: Persistierte Implementierung des SavedMealRepository.
 * Speichert Templates via KeyValueStore (AsyncStorage) und hält einen In-Memory-Cache,
 * nach dem gleichen Storage-Muster wie PersistedFoodEntryRepository (lazy-load,
 * write-through).
 */
export class PersistedSavedMealRepository implements SavedMealRepository {
  private static readonly STORAGE_KEY = 'nutrition:savedMeals';

  private templates: Map<string, SavedMealTemplate> = new Map();
  private isLoaded = false;

  constructor(private readonly keyValueStore: KeyValueStore) {}

  async create(template: SavedMealTemplate): Promise<void> {
    await this.ensureLoaded();
    this.templates.set(template.id, template);
    await this.persist();
  }

  async list(): Promise<SavedMealTemplate[]> {
    await this.ensureLoaded();
    return Array.from(this.templates.values())
      .filter((template) => !template.deletedAt)
      .map((template) => ({ ...template }));
  }

  async getById(id: string): Promise<SavedMealTemplate | null> {
    await this.ensureLoaded();
    const found = this.templates.get(id);
    return found && !found.deletedAt ? { ...found } : null;
  }

  /** ACC-002: soft-delete — no-op if unknown or already tombstoned (idempotent). */
  async delete(id: string, deletedAt: Date): Promise<void> {
    await this.ensureLoaded();
    const existing = this.templates.get(id);
    if (!existing || existing.deletedAt) {
      return;
    }
    this.templates.set(id, { ...existing, deletedAt });
    await this.persist();
  }

  async update(template: SavedMealTemplate): Promise<void> {
    await this.ensureLoaded();
    if (!this.templates.has(template.id)) {
      throw new Error(`SavedMealTemplate with id ${template.id} not found`);
    }
    this.templates.set(template.id, template);
    await this.persist();
  }

  async listIncludingDeleted(): Promise<SavedMealTemplate[]> {
    await this.ensureLoaded();
    return Array.from(this.templates.values()).map((template) => ({ ...template }));
  }

  async getByIdIncludingDeleted(id: string): Promise<SavedMealTemplate | null> {
    await this.ensureLoaded();
    const found = this.templates.get(id);
    return found ? { ...found } : null;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    const storedData = await this.keyValueStore.get(PersistedSavedMealRepository.STORAGE_KEY);

    if (storedData) {
      try {
        const serialized: SerializedSavedMealTemplate[] = JSON.parse(storedData);
        this.templates = new Map(
          serialized.map((template) => [template.id, this.deserializeTemplate(template)]),
        );
      } catch (error) {
        console.error('Failed to parse stored saved meal templates:', error);
        this.templates = new Map();
      }
    }

    await this.migrateLegacyIdsIfNeeded();

    this.isLoaded = true;
  }

  /**
   * ACC-003: one-time migration of legacy (pre-UUIDv4) `SavedMealTemplate.id`s to stable
   * UUIDv4s. Unlike Journal entries, nothing else in local storage references a
   * SavedMealTemplate by id (SavedMealItem has no independent identity — SM-001..SM-008
   * confirmed no other persisted structure keys off a template id), so this is a single-key,
   * single-write migration: either it completes and persists, or (on an interruption before
   * that single `keyValueStore.set` call) nothing was durably written yet and the exact same
   * check simply runs again — with fresh new ids — on the next launch. No durable temporary
   * migration state is needed here, unlike `PersistedFoodEntryRepository`'s Correction Log
   * cross-reference. Includes ACC-002 tombstoned templates; never resurrects one (only `id`
   * is touched, `deletedAt` is untouched).
   */
  private async migrateLegacyIdsIfNeeded(): Promise<void> {
    const templates = Array.from(this.templates.values());
    const needsMigration = templates.some((template) => !isUuidV4(template.id));
    if (!needsMigration) {
      return;
    }

    const result = assignMissingUuids(templates);
    if (result.duplicateLegacyIds.length > 0) {
      console.warn(
        '[ACC-003 migration] duplicate legacy SavedMealTemplate ids detected — each ' +
          'occurrence received its own new UUIDv4:',
        result.duplicateLegacyIds,
      );
    }

    this.templates = new Map(result.records.map((template) => [template.id, template]));
    await this.persist();
  }

  private async persist(): Promise<void> {
    const serialized = Array.from(this.templates.values()).map((template) =>
      this.serializeTemplate(template),
    );
    const json = JSON.stringify(serialized);
    await this.keyValueStore.set(PersistedSavedMealRepository.STORAGE_KEY, json);
  }

  private serializeTemplate(template: SavedMealTemplate): SerializedSavedMealTemplate {
    return {
      id: template.id,
      name: template.name,
      items: template.items.map((item) => this.serializeItem(item)),
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
      deletedAt: template.deletedAt?.toISOString(),
    };
  }

  private serializeItem(item: SavedMealItem): SerializedSavedMealItem {
    return {
      parsedName: item.parsedName,
      quantityGrams: item.quantityGrams,
      foodCatalogRef: item.foodCatalogRef,
      per100g: item.per100g,
    };
  }

  private deserializeTemplate(serialized: SerializedSavedMealTemplate): SavedMealTemplate {
    const template: SavedMealTemplate = {
      id: serialized.id,
      name: serialized.name,
      items: serialized.items.map((item) => this.deserializeItem(item)),
      createdAt: new Date(serialized.createdAt),
      updatedAt: new Date(serialized.updatedAt),
    };

    // ACC-002: absent on every pre-existing record (they predate this field) — leaving it
    // unset here is exactly the safe "not deleted" default, no explicit migration needed.
    if (serialized.deletedAt !== undefined) {
      template.deletedAt = new Date(serialized.deletedAt);
    }

    return template;
  }

  private deserializeItem(serialized: SerializedSavedMealItem): SavedMealItem {
    const item: SavedMealItem = {
      parsedName: serialized.parsedName,
      quantityGrams: serialized.quantityGrams,
    };

    if (serialized.foodCatalogRef !== undefined) {
      item.foodCatalogRef = serialized.foodCatalogRef;
    }

    if (serialized.per100g !== undefined) {
      item.per100g = serialized.per100g;
    }

    return item;
  }

  /**
   * Test-Utility: Löscht alle Templates (nur für Tests).
   */
  async clearAll(): Promise<void> {
    this.templates.clear();
    this.isLoaded = true;
    await this.persist();
  }
}
