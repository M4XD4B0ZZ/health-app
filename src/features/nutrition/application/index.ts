// Ports
export { FoodEntryRepository } from './ports/FoodEntryRepository';
export { Clock } from './ports/Clock';
export { IdGenerator } from './ports/IdGenerator';
export { NutritionLookup } from './ports/NutritionLookup';
export { SavedMealRepository } from './ports/SavedMealRepository';

// Use Cases
export { LogFoodFromRawInputUseCase } from './usecases/LogFoodFromRawInputUseCase';
export { LogMealFromRawInputUseCase } from './usecases/LogMealFromRawInputUseCase';
export { GetDailySummaryUseCase } from './usecases/GetDailySummaryUseCase';
export { DeleteFoodEntryUseCase } from './usecases/DeleteFoodEntryUseCase';
export { EnrichFoodEntryMacrosUseCase } from './usecases/EnrichFoodEntryMacrosUseCase';
export { ApplyNaturalLanguageEditUseCase } from './usecases/ApplyNaturalLanguageEditUseCase';
export { CreateSavedMealFromDateUseCase } from './usecases/CreateSavedMealFromDateUseCase';
export { LogSavedMealToDateUseCase } from './usecases/LogSavedMealToDateUseCase';

// Services
export { FoodCatalogResolver } from './services/FoodCatalogResolver';
export { DefaultFoodCatalogResolver } from './services/DefaultFoodCatalogResolver';
export { SequentialFoodCatalogResolver } from './services/SequentialFoodCatalogResolver';
