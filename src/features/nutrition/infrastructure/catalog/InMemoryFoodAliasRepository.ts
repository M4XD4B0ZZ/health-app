import { FoodAliasRepository } from '../../application/ports/FoodAliasRepository';

export class InMemoryFoodAliasRepository implements FoodAliasRepository {
  private aliases: Map<string, string>;

  constructor() {
    this.aliases = new Map();
  }

  async getCanonicalId(normalized: string): Promise<string | null> {
    return this.aliases.get(normalized) || null;
  }

  async saveAlias(normalized: string, canonicalId: string): Promise<void> {
    this.aliases.set(normalized, canonicalId);
  }
}
