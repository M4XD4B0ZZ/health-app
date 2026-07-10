import { RecoveryRepository } from '../../domain/repositories/RecoveryRepository';
import { NutritionRepository } from '../../domain/repositories/NutritionRepository';
import { MockRecoveryRepository } from '../mocks/MockRecoveryRepository';
import { MockNutritionRepository } from '../mocks/MockNutritionRepository';
import { GetDashboardSummary } from '../../application/usecases/GetDashboardSummary';
import { GetNutritionSummary } from '../../application/usecases/GetNutritionSummary';
import { GetRecoverySummary } from '../../application/usecases/GetRecoverySummary';

// Nutrition Feature
import {
  NutritionEngine,
  PersistedFoodEntryRepository,
  InMemoryNutritionLookup,
  InMemoryFoodCatalog,
  PersistedFoodAliasRepository,
  AsyncStorageKeyValueStore,
  FakeAiFoodMapper,
  SystemClock as NutritionSystemClock,
  RandomIdGenerator as NutritionRandomIdGenerator,
  DeterministicFoodParser,
  FakeAiMealParser,
  LogFoodFromRawInputUseCase,
  LogMealFromRawInputUseCase,
  GetDailySummaryUseCase,
  ApplyNaturalLanguageEditUseCase,
  EditFoodEntryFromNaturalLanguageUseCase,
  DeleteFoodEntryUseCase,
  EnrichFoodEntryMacrosUseCase,
  PersistedReminderSettingsRepository,
  PersistedPortionHintRepository,
  GetReminderSettingsUseCase,
  SetReminderSettingsUseCase,
  GetReminderDecisionUseCase,
  GetCalendarMonthSummaryUseCase,
  UndoAutoMergeUseCase,
  PersistedSavedMealRepository,
  CreateSavedMealFromDateUseCase,
  LogSavedMealToDateUseCase,
  ListSavedMealTemplatesUseCase,
  DeleteSavedMealTemplateUseCase,
  RenameSavedMealTemplateUseCase,
} from '../../features/nutrition';
import { PortionKnowledgeService } from '../../features/nutrition/domain/portion/PortionKnowledgeService';
import { SEED_PORTION_HINTS } from '../../features/nutrition/domain/portion/seedPortionHints';

import { SequentialFoodCatalogResolver } from '../../features/nutrition/application/services/SequentialFoodCatalogResolver';
import { DefaultConfidenceEngine } from '../../features/nutrition/domain/confidence/DefaultConfidenceEngine';
import { MockOffSource } from '../../features/nutrition/infrastructure/catalog/sources/MockOffSource';
import { MockUsdaSource } from '../../features/nutrition/infrastructure/catalog/sources/MockUsdaSource';
import { BlsStaticSource } from '../../features/nutrition/infrastructure/catalog/sources/BlsStaticSource';
import { SupabaseEdgeOffSource } from '../../features/nutrition/infrastructure/catalog/sources/SupabaseEdgeOffSource';
import { SupabaseEdgeUsdaSource } from '../../features/nutrition/infrastructure/catalog/sources/SupabaseEdgeUsdaSource';
import { SupabaseUserAliasSource } from '../../features/nutrition/infrastructure/catalog/sources/SupabaseUserAliasSource';
import { SupabaseEdgeOffProvider } from '../../features/nutrition/infrastructure/catalog/providers/SupabaseEdgeOffProvider';
import { SupabaseEdgeUsdaProvider } from '../../features/nutrition/infrastructure/catalog/providers/SupabaseEdgeUsdaProvider';
import { DEFAULT_CATALOG_CONFIG } from '../../features/nutrition/domain/models/FoodCatalogConfig';
import { supabase } from '../supabase/supabaseClient';
import type { AuthRepository } from '../../features/auth/application/ports/AuthRepository';
import { SupabaseAuthRepository } from '../../features/auth/infrastructure/SupabaseAuthRepository';
import { isProdBuild, envName } from '../config/appEnv';
import {
  ResolverSourceLabel,
  toResolverSourceLabel,
} from '../../features/nutrition/application/services/ResolverSourceLabel';

import {
  FoodAliasRepository,
  FoodEntryRepository,
  KeyValueStore,
  ReminderSettingsRepository,
  SavedMealRepository,
} from '../../features/nutrition/application/ports';
import { FoodCatalogSource } from '../../features/nutrition/domain/catalog/FoodCatalogSource';

// Goals Feature
import {
  PersistedMetabolismProfileRepository,
  PersistedEffectiveGoalsRepository,
  MetabolismProfileRepository,
  EffectiveGoalsRepository,
  SystemClock as GoalsSystemClock,
  RandomIdGenerator as GoalsRandomIdGenerator,
  UpsertMetabolismProfileUseCase,
  ComputeMetabolismResultUseCase,
  SuggestGoalsUseCase,
  SetEffectiveGoalsUseCase,
} from '../../features/goals';

// Journal Feature
import {
  NutritionReadRepositoryFromFoodEntryRepository,
  ComputeProgressForDateUseCase,
} from '../../features/journal';

// Evaluation Feature
import {
  EvaluationProfileRegistry,
  PersistedActiveProfileRepository,
  EvidenceBasedStandardProfile,
  WeightLossProfile,
  CalorieMacroCorridorRule,
  ProteinPreservingDeficitRule,
  EvidenceBasedStandardSettingsProvider,
  WeightLossSettingsProvider,
  BuildEvaluationInputForDateUseCase,
  GetActiveEvaluationOutputUseCase,
} from '../../features/evaluation';

/**
 * Dependency Container für die Anwendung
 * Stellt alle Repositories, Services und Use Cases bereit
 */
class Container {
  private static readonly MOCK_SECURITY_ERROR =
    'SECURITY: Mock sources must never be enabled in production builds.';

  // Legacy Repositories
  private _recoveryRepository: RecoveryRepository;
  private _nutritionRepository: NutritionRepository;

  // Legacy Usecases
  private _getDashboardSummary: GetDashboardSummary;
  private _getNutritionSummary: GetNutritionSummary;
  private _getRecoverySummary: GetRecoverySummary;

  // Nutrition Feature - Infrastructure
  private _nutritionEngine: NutritionEngine;
  private _foodEntryRepository: FoodEntryRepository;
  private _nutritionLookup: InMemoryNutritionLookup;
  private _foodCatalog: InMemoryFoodCatalog;
  private _keyValueStore: KeyValueStore;
  private _foodAliasRepository: FoodAliasRepository;
  private _aiFoodMapper: FakeAiFoodMapper;
  private _nutritionClock: NutritionSystemClock;
  private _nutritionIdGenerator: NutritionRandomIdGenerator;
  private _foodParser: DeterministicFoodParser;
  private _aiMealParser: FakeAiMealParser;
  private _authRepository: AuthRepository;
  private _reminderSettingsRepository: ReminderSettingsRepository;
  private _portionKnowledgeService: PortionKnowledgeService;
  private _savedMealRepository: SavedMealRepository;

  // Goals Feature - Infrastructure
  private _metabolismProfileRepository: MetabolismProfileRepository;
  private _effectiveGoalsRepository: EffectiveGoalsRepository;
  private _goalsClock: GoalsSystemClock;
  private _goalsIdGenerator: GoalsRandomIdGenerator;

  // Journal Feature - Infrastructure
  private _nutritionReadRepository: NutritionReadRepositoryFromFoodEntryRepository;

  // Nutrition Use Cases
  private _logFoodFromRawInputUseCase: LogFoodFromRawInputUseCase;
  private _logMealFromRawInputUseCase: LogMealFromRawInputUseCase;
  private _getDailySummaryUseCase: GetDailySummaryUseCase;
  private _applyNaturalLanguageEditUseCase: ApplyNaturalLanguageEditUseCase;
  private _editFoodEntryFromNaturalLanguageUseCase: EditFoodEntryFromNaturalLanguageUseCase;
  private _deleteFoodEntryUseCase: DeleteFoodEntryUseCase;
  private _undoAutoMergeUseCase: UndoAutoMergeUseCase;
  private _enrichFoodEntryMacrosUseCase: EnrichFoodEntryMacrosUseCase;
  private _getReminderSettingsUseCase: GetReminderSettingsUseCase;
  private _setReminderSettingsUseCase: SetReminderSettingsUseCase;
  private _getReminderDecisionUseCase: GetReminderDecisionUseCase;
  private _getCalendarMonthSummaryUseCase: GetCalendarMonthSummaryUseCase;

  // Goals Use Cases
  private _upsertMetabolismProfileUseCase: UpsertMetabolismProfileUseCase;
  private _computeMetabolismResultUseCase: ComputeMetabolismResultUseCase;
  private _suggestGoalsUseCase: SuggestGoalsUseCase;
  private _setEffectiveGoalsUseCase: SetEffectiveGoalsUseCase;

  // Saved Meal Use Cases
  private _createSavedMealFromDateUseCase: CreateSavedMealFromDateUseCase;
  private _logSavedMealToDateUseCase: LogSavedMealToDateUseCase;
  private _listSavedMealTemplatesUseCase: ListSavedMealTemplatesUseCase;
  private _deleteSavedMealTemplateUseCase: DeleteSavedMealTemplateUseCase;
  private _renameSavedMealTemplateUseCase: RenameSavedMealTemplateUseCase;

  // Journal Use Cases
  private _computeProgressForDateUseCase: ComputeProgressForDateUseCase;
  private _registeredResolverSourceLabels: ResolverSourceLabel[] = [];

  // Evaluation Feature
  private _evaluationProfileRegistry: EvaluationProfileRegistry;
  private _buildEvaluationInputForDateUseCase: BuildEvaluationInputForDateUseCase;
  private _getActiveEvaluationOutputUseCase: GetActiveEvaluationOutputUseCase;

  constructor() {
    // Legacy repositories
    this._recoveryRepository = new MockRecoveryRepository();
    this._nutritionRepository = new MockNutritionRepository();

    // Nutrition infrastructure
    this._nutritionEngine = new NutritionEngine();
    this._keyValueStore = new AsyncStorageKeyValueStore();
    this._foodEntryRepository = new PersistedFoodEntryRepository(this._keyValueStore);
    this._nutritionLookup = new InMemoryNutritionLookup();
    this._foodCatalog = new InMemoryFoodCatalog();
    this._foodAliasRepository = new PersistedFoodAliasRepository(this._keyValueStore);
    this._aiFoodMapper = new FakeAiFoodMapper();
    this._nutritionClock = new NutritionSystemClock();
    this._nutritionIdGenerator = new NutritionRandomIdGenerator();
    this._foodParser = new DeterministicFoodParser();
    this._aiMealParser = new FakeAiMealParser();
    this._authRepository = new SupabaseAuthRepository();
    this._reminderSettingsRepository = new PersistedReminderSettingsRepository(this._keyValueStore);
    this._portionKnowledgeService = new PortionKnowledgeService(
      new PersistedPortionHintRepository(this._keyValueStore, SEED_PORTION_HINTS),
    );
    this._savedMealRepository = new PersistedSavedMealRepository(this._keyValueStore);

    this._createSavedMealFromDateUseCase = new CreateSavedMealFromDateUseCase(
      this._foodEntryRepository,
      this._savedMealRepository,
      this._nutritionClock,
      this._nutritionIdGenerator,
    );
    this._logSavedMealToDateUseCase = new LogSavedMealToDateUseCase(
      this._savedMealRepository,
      this._foodEntryRepository,
      this._nutritionClock,
      this._nutritionIdGenerator,
      this._nutritionLookup,
    );
    this._listSavedMealTemplatesUseCase = new ListSavedMealTemplatesUseCase(
      this._savedMealRepository,
    );
    this._deleteSavedMealTemplateUseCase = new DeleteSavedMealTemplateUseCase(
      this._savedMealRepository,
    );
    this._renameSavedMealTemplateUseCase = new RenameSavedMealTemplateUseCase(
      this._savedMealRepository,
      this._nutritionClock,
    );

    // Goals infrastructure
    this._metabolismProfileRepository = new PersistedMetabolismProfileRepository(
      this._keyValueStore,
    );
    this._effectiveGoalsRepository = new PersistedEffectiveGoalsRepository(this._keyValueStore);
    this._goalsClock = new GoalsSystemClock();
    this._goalsIdGenerator = new GoalsRandomIdGenerator();

    // Journal infrastructure
    this._nutritionReadRepository = new NutritionReadRepositoryFromFoodEntryRepository(
      this._foodEntryRepository,
    );

    // Nutrition use cases
    // Erstelle Sequential Resolver mit User Aliases -> OFF -> USDA (+ optional mocks in dev/test)
    const confidenceEngine = new DefaultConfidenceEngine();
    const userAliasSource = new SupabaseUserAliasSource(supabase, DEFAULT_CATALOG_CONFIG);
    const blsSource = new BlsStaticSource();
    const offSource = new SupabaseEdgeOffSource(
      new SupabaseEdgeOffProvider(supabase),
      DEFAULT_CATALOG_CONFIG,
    );
    const usdaSource = new SupabaseEdgeUsdaSource(
      new SupabaseEdgeUsdaProvider(supabase),
      DEFAULT_CATALOG_CONFIG,
    );
    const resolverSources: FoodCatalogSource[] = [
      userAliasSource,
      blsSource,
      offSource,
      usdaSource,
    ];

    // Mocks are only allowed in test environments OR if explicitly requested via env.
    // This enforces real-world resolver paths during standard Expo development (npm start)
    const allowMocks = process.env.EXPO_PUBLIC_ALLOW_MOCK_SOURCES === 'true';

    if (envName() === 'test' || allowMocks) {
      resolverSources.push(this.createMockOffSource(), this.createMockUsdaSource());
    }

    this._registeredResolverSourceLabels = resolverSources.map((source) =>
      toResolverSourceLabel(source.type, source.constructor.name),
    );

    // Keep references to in-memory helpers for tests/diagnostics but avoid unused-import lint warnings
    // Reference names to avoid unused import warnings in DI container. These are intentionally unused here.
    const _diagInMemoryReferences = [
      'InMemoryFoodEntryRepository',
      'InMemoryFoodAliasRepository',
      'isDevBuild',
    ];
    void _diagInMemoryReferences;

    const foodCatalogResolver = new SequentialFoodCatalogResolver(
      resolverSources,
      confidenceEngine,
      DEFAULT_CATALOG_CONFIG,
    );
    if (!foodCatalogResolver) throw new Error('DI_MISSING_FOOD_CATALOG_RESOLVER');

    this._logFoodFromRawInputUseCase = new LogFoodFromRawInputUseCase(
      this._foodEntryRepository,
      this._nutritionClock,
      this._nutritionIdGenerator,
      this._foodParser,
      this._foodCatalog,
      this._foodAliasRepository,
      this._aiFoodMapper,
      this._nutritionLookup,
      foodCatalogResolver,
      this._portionKnowledgeService,
    );

    this._logMealFromRawInputUseCase = new LogMealFromRawInputUseCase(
      this._foodEntryRepository,
      this._nutritionClock,
      this._nutritionIdGenerator,
      this._foodParser,
      this._foodCatalog,
      this._foodAliasRepository,
      this._aiFoodMapper,
      this._nutritionLookup,
      this._aiMealParser,
      foodCatalogResolver,
      this._portionKnowledgeService,
    );

    this._getDailySummaryUseCase = new GetDailySummaryUseCase(
      this._foodEntryRepository,
      this._effectiveGoalsRepository,
    );

    this._applyNaturalLanguageEditUseCase = new ApplyNaturalLanguageEditUseCase(
      this._foodEntryRepository,
      this._nutritionLookup,
      this._nutritionClock,
    );

    this._editFoodEntryFromNaturalLanguageUseCase = new EditFoodEntryFromNaturalLanguageUseCase(
      this._foodEntryRepository,
      this._nutritionLookup,
      this._nutritionClock,
    );

    this._deleteFoodEntryUseCase = new DeleteFoodEntryUseCase(
      this._foodEntryRepository,
      this._nutritionClock,
    );

    this._undoAutoMergeUseCase = new UndoAutoMergeUseCase(
      this._foodEntryRepository,
      this._nutritionClock,
    );

    this._enrichFoodEntryMacrosUseCase = new EnrichFoodEntryMacrosUseCase(
      this._foodEntryRepository,
      this._nutritionLookup,
    );
    this._getReminderSettingsUseCase = new GetReminderSettingsUseCase(
      this._reminderSettingsRepository,
    );
    this._setReminderSettingsUseCase = new SetReminderSettingsUseCase(
      this._reminderSettingsRepository,
    );
    this._getReminderDecisionUseCase = new GetReminderDecisionUseCase(
      this._getDailySummaryUseCase,
      this._reminderSettingsRepository,
      'Europe/Berlin',
    );
    this._getCalendarMonthSummaryUseCase = new GetCalendarMonthSummaryUseCase(
      this._foodEntryRepository,
      this._effectiveGoalsRepository,
      'Europe/Berlin',
    );

    // Goals use cases
    this._upsertMetabolismProfileUseCase = new UpsertMetabolismProfileUseCase(
      this._metabolismProfileRepository,
      this._goalsClock,
      this._goalsIdGenerator,
    );

    this._computeMetabolismResultUseCase = new ComputeMetabolismResultUseCase(
      this._metabolismProfileRepository,
    );

    this._suggestGoalsUseCase = new SuggestGoalsUseCase(
      this._metabolismProfileRepository,
      this._goalsClock,
    );

    this._setEffectiveGoalsUseCase = new SetEffectiveGoalsUseCase(this._effectiveGoalsRepository);

    // Journal use cases
    this._computeProgressForDateUseCase = new ComputeProgressForDateUseCase(
      this._nutritionReadRepository,
      this._effectiveGoalsRepository,
    );

    // Evaluation Engine (DI-001/DI-002): known profiles/rules/settings-providers are a
    // fixed, code-defined composition today (Presets, per Product Bible SS4/SS5) -- adding a
    // future profile means extending these three arrays, not changing the wiring shape.
    this._evaluationProfileRegistry = new PersistedActiveProfileRepository(this._keyValueStore, [
      EvidenceBasedStandardProfile,
      WeightLossProfile,
    ]);
    this._buildEvaluationInputForDateUseCase = new BuildEvaluationInputForDateUseCase(
      this._foodEntryRepository,
      [
        new EvidenceBasedStandardSettingsProvider(this._effectiveGoalsRepository),
        new WeightLossSettingsProvider(this._computeMetabolismResultUseCase),
      ],
    );
    this._getActiveEvaluationOutputUseCase = new GetActiveEvaluationOutputUseCase(
      this._evaluationProfileRegistry,
      [CalorieMacroCorridorRule, ProteinPreservingDeficitRule],
    );

    // Legacy usecases
    this._getDashboardSummary = new GetDashboardSummary(
      this._recoveryRepository,
      this._nutritionRepository,
    );

    this._getNutritionSummary = new GetNutritionSummary(this._nutritionRepository);

    this._getRecoverySummary = new GetRecoverySummary(this._recoveryRepository);
  }

  // Legacy Repositories
  get recoveryRepository(): RecoveryRepository {
    return this._recoveryRepository;
  }

  get nutritionRepository(): NutritionRepository {
    return this._nutritionRepository;
  }

  // Legacy Usecases
  get getDashboardSummary(): GetDashboardSummary {
    return this._getDashboardSummary;
  }

  get getNutritionSummary(): GetNutritionSummary {
    return this._getNutritionSummary;
  }

  get getRecoverySummary(): GetRecoverySummary {
    return this._getRecoverySummary;
  }

  // Nutrition Infrastructure
  get nutritionEngine(): NutritionEngine {
    return this._nutritionEngine;
  }

  get foodEntryRepository(): FoodEntryRepository {
    return this._foodEntryRepository;
  }

  get nutritionLookup(): InMemoryNutritionLookup {
    return this._nutritionLookup;
  }

  get authRepository(): AuthRepository {
    return this._authRepository;
  }

  get portionKnowledgeService(): PortionKnowledgeService {
    return this._portionKnowledgeService;
  }

  get savedMealRepository(): SavedMealRepository {
    return this._savedMealRepository;
  }

  // Saved Meal Use Cases
  get createSavedMealFromDateUseCase(): CreateSavedMealFromDateUseCase {
    return this._createSavedMealFromDateUseCase;
  }

  get logSavedMealToDateUseCase(): LogSavedMealToDateUseCase {
    return this._logSavedMealToDateUseCase;
  }

  get listSavedMealTemplatesUseCase(): ListSavedMealTemplatesUseCase {
    return this._listSavedMealTemplatesUseCase;
  }

  get deleteSavedMealTemplateUseCase(): DeleteSavedMealTemplateUseCase {
    return this._deleteSavedMealTemplateUseCase;
  }

  get renameSavedMealTemplateUseCase(): RenameSavedMealTemplateUseCase {
    return this._renameSavedMealTemplateUseCase;
  }

  // Goals Infrastructure
  get metabolismProfileRepository(): MetabolismProfileRepository {
    return this._metabolismProfileRepository;
  }

  get effectiveGoalsRepository(): EffectiveGoalsRepository {
    return this._effectiveGoalsRepository;
  }

  // Nutrition Use Cases
  get logFoodFromRawInputUseCase(): LogFoodFromRawInputUseCase {
    return this._logFoodFromRawInputUseCase;
  }

  get logMealFromRawInputUseCase(): LogMealFromRawInputUseCase {
    return this._logMealFromRawInputUseCase;
  }

  get getDailySummaryUseCase(): GetDailySummaryUseCase {
    return this._getDailySummaryUseCase;
  }

  get applyNaturalLanguageEditUseCase(): ApplyNaturalLanguageEditUseCase {
    return this._applyNaturalLanguageEditUseCase;
  }

  get editFoodEntryFromNaturalLanguageUseCase(): EditFoodEntryFromNaturalLanguageUseCase {
    return this._editFoodEntryFromNaturalLanguageUseCase;
  }

  get deleteFoodEntryUseCase(): DeleteFoodEntryUseCase {
    return this._deleteFoodEntryUseCase;
  }

  get undoAutoMergeUseCase(): UndoAutoMergeUseCase {
    return this._undoAutoMergeUseCase;
  }

  get enrichFoodEntryMacrosUseCase(): EnrichFoodEntryMacrosUseCase {
    return this._enrichFoodEntryMacrosUseCase;
  }

  get getReminderSettingsUseCase(): GetReminderSettingsUseCase {
    return this._getReminderSettingsUseCase;
  }

  get setReminderSettingsUseCase(): SetReminderSettingsUseCase {
    return this._setReminderSettingsUseCase;
  }

  get getReminderDecisionUseCase(): GetReminderDecisionUseCase {
    return this._getReminderDecisionUseCase;
  }

  get getCalendarMonthSummaryUseCase(): GetCalendarMonthSummaryUseCase {
    return this._getCalendarMonthSummaryUseCase;
  }

  // Goals Use Cases
  get upsertMetabolismProfileUseCase(): UpsertMetabolismProfileUseCase {
    return this._upsertMetabolismProfileUseCase;
  }

  get computeMetabolismResultUseCase(): ComputeMetabolismResultUseCase {
    return this._computeMetabolismResultUseCase;
  }

  get suggestGoalsUseCase(): SuggestGoalsUseCase {
    return this._suggestGoalsUseCase;
  }

  get setEffectiveGoalsUseCase(): SetEffectiveGoalsUseCase {
    return this._setEffectiveGoalsUseCase;
  }

  // Journal Use Cases
  get computeProgressForDateUseCase(): ComputeProgressForDateUseCase {
    return this._computeProgressForDateUseCase;
  }

  // Evaluation Engine
  get evaluationProfileRegistry(): EvaluationProfileRegistry {
    return this._evaluationProfileRegistry;
  }

  get buildEvaluationInputForDateUseCase(): BuildEvaluationInputForDateUseCase {
    return this._buildEvaluationInputForDateUseCase;
  }

  get getActiveEvaluationOutputUseCase(): GetActiveEvaluationOutputUseCase {
    return this._getActiveEvaluationOutputUseCase;
  }

  getRegisteredResolverSourceLabelsForDiagnostics(): ResolverSourceLabel[] {
    return [...this._registeredResolverSourceLabels];
  }

  private createMockOffSource(): MockOffSource {
    if (isProdBuild()) {
      throw new Error(Container.MOCK_SECURITY_ERROR);
    }

    return new MockOffSource();
  }

  private createMockUsdaSource(): MockUsdaSource {
    if (isProdBuild()) {
      throw new Error(Container.MOCK_SECURITY_ERROR);
    }

    return new MockUsdaSource();
  }
}

// Singleton-Instanz erstellen
const container = new Container();

export function getRegisteredResolverSourcesForDiagnostics(): ResolverSourceLabel[] {
  try {
    return container.getRegisteredResolverSourceLabelsForDiagnostics();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    // In isolated test environments, return empty array as fallback
    return [];
  }
}

// Container exportieren
export default container;
