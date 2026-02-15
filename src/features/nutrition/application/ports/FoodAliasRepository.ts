export interface FoodAliasRepository {
  getCanonicalId(normalized: string): Promise<string | null>;
  saveAlias(normalized: string, canonicalId: string): Promise<void>;
}
