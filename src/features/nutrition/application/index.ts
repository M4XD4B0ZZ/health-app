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
export { EditFoodEntryFromNaturalLanguageUseCase } from './usecases/EditFoodEntryFromNaturalLanguageUseCase';
export { CreateSavedMealFromDateUseCase } from './usecases/CreateSavedMealFromDateUseCase';
export { LogSavedMealToDateUseCase } from './usecases/LogSavedMealToDateUseCase';
export { GetReminderSettingsUseCase } from './usecases/GetReminderSettingsUseCase';
export { SetReminderSettingsUseCase } from './usecases/SetReminderSettingsUseCase';
export { GetReminderDecisionUseCase } from './usecases/GetReminderDecisionUseCase';
export { GetCalendarMonthSummaryUseCase } from './usecases/GetCalendarMonthSummaryUseCase';
export { UndoAutoMergeUseCase } from './usecases/UndoAutoMergeUseCase';
export { ListSavedMealTemplatesUseCase } from './usecases/ListSavedMealTemplatesUseCase';
export { DeleteSavedMealTemplateUseCase } from './usecases/DeleteSavedMealTemplateUseCase';
export { RenameSavedMealTemplateUseCase } from './usecases/RenameSavedMealTemplateUseCase';
export { DeleteResolverObservationsForCurrentOwner } from './usecases/DeleteResolverObservationsForCurrentOwner';
export { RecordPersonalResolutionMemoryUseCase } from './usecases/RecordPersonalResolutionMemoryUseCase';
export { ReadPersonalResolutionMemoryUseCase } from './usecases/ReadPersonalResolutionMemoryUseCase';

// Services
export { FoodCatalogResolver } from './services/FoodCatalogResolver';
export { DefaultFoodCatalogResolver } from './services/DefaultFoodCatalogResolver';
export { SequentialFoodCatalogResolver } from './services/SequentialFoodCatalogResolver';
export { PersonalResolutionMemoryAwareFoodCatalogResolver } from './services/PersonalResolutionMemoryAwareFoodCatalogResolver';
