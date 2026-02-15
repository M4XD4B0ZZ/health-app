import { NutritionLookup } from '../../application/ports/NutritionLookup';
import { NutritionPer100g } from '../../domain/models/NutritionTypes';

/**
 * Demo-Daten für deterministische Nutrition Lookup.
 * Werte sind Näherungswerte pro 100g für Architektur-Demo.
 */
const DEMO_NUTRITION_DATA: Record<string, NutritionPer100g> = {
  banana: {
    calories: 89,
    protein: 1.1,
    carbs: 22.8,
    fat: 0.3,
  },
  'chicken breast': {
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
  },
  skyr: {
    calories: 57,
    protein: 11,
    carbs: 4,
    fat: 0.2,
  },
  egg: {
    calories: 155,
    protein: 13,
    carbs: 1.1,
    fat: 11,
  },
};

/**
 * In-Memory Implementierung von NutritionLookup.
 * Verwendet Map für schnelle Lookups, mit Demo-Daten vorseeded.
 */
export class InMemoryNutritionLookup implements NutritionLookup {
  private readonly data: Map<string, NutritionPer100g>;

  constructor(initialData?: Record<string, NutritionPer100g>) {
    this.data = new Map();
    const seedData = initialData ?? DEMO_NUTRITION_DATA;
    
    // Seed mit normalisierten Keys (lowercase, trimmed)
    for (const [name, nutrition] of Object.entries(seedData)) {
      const normalizedKey = this.normalizeKey(name);
      this.data.set(normalizedKey, nutrition);
    }
  }

  async getPer100gByName(normalizedName: string): Promise<NutritionPer100g | null> {
    const key = this.normalizeKey(normalizedName);
    return this.data.get(key) ?? null;
  }

  async upsertPer100gByName(normalizedName: string, per100g: NutritionPer100g): Promise<void> {
    const key = this.normalizeKey(normalizedName);
    this.data.set(key, per100g);
  }

  /**
   * Normalisiert den Key defensiv: trim + lowercase.
   * Input sollte bereits normalisiert sein, aber wir sind defensiv.
   */
  private normalizeKey(name: string): string {
    return name.trim().toLowerCase();
  }
}
