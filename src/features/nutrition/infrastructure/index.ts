export { InMemoryFoodEntryRepository } from './repositories/InMemoryFoodEntryRepository';
export { PersistedFoodEntryRepository } from './repositories/PersistedFoodEntryRepository';
export { InMemoryNutritionLookup } from './repositories/InMemoryNutritionLookup';
export { InMemorySavedMealRepository } from './repositories/InMemorySavedMealRepository';
export { SystemClock } from './SystemClock';
export { RandomIdGenerator, TestIdGenerator } from './RandomIdGenerator';
export { DeterministicFoodParser, DeterministicParseResult } from './parsers/DeterministicFoodParser';
export { FakeAiMealParser } from './ai';
export { InMemoryFoodCatalog } from './catalog/InMemoryFoodCatalog';
export { InMemoryFoodAliasRepository } from './catalog/InMemoryFoodAliasRepository';
export { PersistedFoodAliasRepository } from './catalog/PersistedFoodAliasRepository';
export { FakeAiFoodMapper } from './ai/FakeAiFoodMapper';
export { AsyncStorageKeyValueStore, FakeKeyValueStore } from './storage';

// Catalog providers
export {
  FoodSourceProvider,
  EdgeSearchResponse,
  EdgeFoodItem,
  isEdgeSearchResponse,
  SupabaseEdgeOffProvider,
  SupabaseEdgeUsdaProvider,
  SupabaseClient
} from './catalog/providers';

// Catalog sources
export {
  MockOffSource,
  MockUsdaSource,
  SupabaseEdgeOffSource,
  SupabaseEdgeUsdaSource
} from './catalog/sources';

// Catalog utilities
export { withRetry, RetryConfig, DEFAULT_RETRY_CONFIG } from './catalog/providers/RetryHelper';
export { getCatalogErrorMessage, isNoResultsCase } from './catalog/ErrorMessageHelper';
