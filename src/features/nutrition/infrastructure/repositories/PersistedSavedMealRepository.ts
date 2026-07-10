import { SavedMealTemplate, SavedMealItem } from '../../domain/models/SavedMealTypes';
import { SavedMealRepository } from '../../application/ports/SavedMealRepository';
import { KeyValueStore } from '../../application/ports/KeyValueStore';
import { FoodSourceType } from '../../domain/catalog/FoodCatalogSource';

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
    return Array.from(this.templates.values()).map((template) => ({ ...template }));
  }

  async getById(id: string): Promise<SavedMealTemplate | null> {
    await this.ensureLoaded();
    const found = this.templates.get(id);
    return found ? { ...found } : null;
  }

  async delete(id: string): Promise<void> {
    await this.ensureLoaded();
    this.templates.delete(id);
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

    this.isLoaded = true;
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
    return {
      id: serialized.id,
      name: serialized.name,
      items: serialized.items.map((item) => this.deserializeItem(item)),
      createdAt: new Date(serialized.createdAt),
      updatedAt: new Date(serialized.updatedAt),
    };
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
