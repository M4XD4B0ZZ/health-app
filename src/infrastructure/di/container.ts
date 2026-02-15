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
  InMemoryFoodEntryRepository,
  InMemoryNutritionLookup,
  InMemoryFoodCatalog,
  InMemoryFoodAliasRepository,
  FakeAiFoodMapper,
  SystemClock as NutritionSystemClock,
  RandomIdGenerator as NutritionRandomIdGenerator,
  DeterministicFoodParser,
  FakeAiMealParser,
  LogFoodFromRawInputUseCase,
  LogMealFromRawInputUseCase,
  GetDailySummaryUseCase,
  ApplyNaturalLanguageEditUseCase,
  DeleteFoodEntryUseCase,
  EnrichFoodEntryMacrosUseCase,
} from '../../features/nutrition';

// Goals Feature
import {
  InMemoryMetabolismProfileRepository,
  InMemoryEffectiveGoalsRepository,
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

/**
 * Dependency Container für die Anwendung
 * Stellt alle Repositories, Services und Use Cases bereit
 */
class Container {
  // Legacy Repositories
  private _recoveryRepository: RecoveryRepository;
  private _nutritionRepository: NutritionRepository;
  
  // Legacy Usecases
  private _getDashboardSummary: GetDashboardSummary;
  private _getNutritionSummary: GetNutritionSummary;
  private _getRecoverySummary: GetRecoverySummary;

  // Nutrition Feature - Infrastructure
  private _nutritionEngine: NutritionEngine;
  private _foodEntryRepository: InMemoryFoodEntryRepository;
  private _nutritionLookup: InMemoryNutritionLookup;
  private _foodCatalog: InMemoryFoodCatalog;
  private _foodAliasRepository: InMemoryFoodAliasRepository;
  private _aiFoodMapper: FakeAiFoodMapper;
  private _nutritionClock: NutritionSystemClock;
  private _nutritionIdGenerator: NutritionRandomIdGenerator;
  private _foodParser: DeterministicFoodParser;
  private _aiMealParser: FakeAiMealParser;

  // Goals Feature - Infrastructure
  private _metabolismProfileRepository: InMemoryMetabolismProfileRepository;
  private _effectiveGoalsRepository: InMemoryEffectiveGoalsRepository;
  private _goalsClock: GoalsSystemClock;
  private _goalsIdGenerator: GoalsRandomIdGenerator;

  // Journal Feature - Infrastructure
  private _nutritionReadRepository: NutritionReadRepositoryFromFoodEntryRepository;

  // Nutrition Use Cases
  private _logFoodFromRawInputUseCase: LogFoodFromRawInputUseCase;
  private _logMealFromRawInputUseCase: LogMealFromRawInputUseCase;
  private _getDailySummaryUseCase: GetDailySummaryUseCase;
  private _applyNaturalLanguageEditUseCase: ApplyNaturalLanguageEditUseCase;
  private _deleteFoodEntryUseCase: DeleteFoodEntryUseCase;
  private _enrichFoodEntryMacrosUseCase: EnrichFoodEntryMacrosUseCase;

  // Goals Use Cases
  private _upsertMetabolismProfileUseCase: UpsertMetabolismProfileUseCase;
  private _computeMetabolismResultUseCase: ComputeMetabolismResultUseCase;
  private _suggestGoalsUseCase: SuggestGoalsUseCase;
  private _setEffectiveGoalsUseCase: SetEffectiveGoalsUseCase;

  // Journal Use Cases
  private _computeProgressForDateUseCase: ComputeProgressForDateUseCase;
  
  constructor() {
    // Legacy repositories
    this._recoveryRepository = new MockRecoveryRepository();
    this._nutritionRepository = new MockNutritionRepository();
    
    // Nutrition infrastructure
    this._nutritionEngine = new NutritionEngine();
    this._foodEntryRepository = new InMemoryFoodEntryRepository();
    this._nutritionLookup = new InMemoryNutritionLookup();
    this._foodCatalog = new InMemoryFoodCatalog();
    this._foodAliasRepository = new InMemoryFoodAliasRepository();
    this._aiFoodMapper = new FakeAiFoodMapper();
    this._nutritionClock = new NutritionSystemClock();
    this._nutritionIdGenerator = new NutritionRandomIdGenerator();
    this._foodParser = new DeterministicFoodParser();
    this._aiMealParser = new FakeAiMealParser();

    // Goals infrastructure
    this._metabolismProfileRepository = new InMemoryMetabolismProfileRepository();
    this._effectiveGoalsRepository = new InMemoryEffectiveGoalsRepository();
    this._goalsClock = new GoalsSystemClock();
    this._goalsIdGenerator = new GoalsRandomIdGenerator();

    // Journal infrastructure
    this._nutritionReadRepository = new NutritionReadRepositoryFromFoodEntryRepository(
      this._foodEntryRepository
    );

    // Nutrition use cases
    this._logFoodFromRawInputUseCase = new LogFoodFromRawInputUseCase(
      this._foodEntryRepository,
      this._nutritionClock,
      this._nutritionIdGenerator,
      this._foodParser,
      this._foodCatalog,
      this._foodAliasRepository,
      this._aiFoodMapper,
      this._nutritionLookup
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
      this._aiMealParser
    );

    this._getDailySummaryUseCase = new GetDailySummaryUseCase(
      this._foodEntryRepository,
      this._nutritionEngine
    );

    this._applyNaturalLanguageEditUseCase = new ApplyNaturalLanguageEditUseCase(
      this._foodEntryRepository,
      this._nutritionLookup,
      this._nutritionClock
    );

    this._deleteFoodEntryUseCase = new DeleteFoodEntryUseCase(
      this._foodEntryRepository
    );

    this._enrichFoodEntryMacrosUseCase = new EnrichFoodEntryMacrosUseCase(
      this._foodEntryRepository,
      this._nutritionLookup
    );

    // Goals use cases
    this._upsertMetabolismProfileUseCase = new UpsertMetabolismProfileUseCase(
      this._metabolismProfileRepository,
      this._goalsClock,
      this._goalsIdGenerator
    );

    this._computeMetabolismResultUseCase = new ComputeMetabolismResultUseCase(
      this._metabolismProfileRepository
    );

    this._suggestGoalsUseCase = new SuggestGoalsUseCase(
      this._metabolismProfileRepository,
      this._goalsClock
    );

    this._setEffectiveGoalsUseCase = new SetEffectiveGoalsUseCase(
      this._effectiveGoalsRepository
    );

    // Journal use cases
    this._computeProgressForDateUseCase = new ComputeProgressForDateUseCase(
      this._nutritionReadRepository,
      this._effectiveGoalsRepository
    );
    
    // Legacy usecases
    this._getDashboardSummary = new GetDashboardSummary(
      this._recoveryRepository,
      this._nutritionRepository
    );
    
    this._getNutritionSummary = new GetNutritionSummary(
      this._nutritionRepository
    );
    
    this._getRecoverySummary = new GetRecoverySummary(
      this._recoveryRepository
    );
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

  get foodEntryRepository(): InMemoryFoodEntryRepository {
    return this._foodEntryRepository;
  }

  get nutritionLookup(): InMemoryNutritionLookup {
    return this._nutritionLookup;
  }

  // Goals Infrastructure
  get metabolismProfileRepository(): InMemoryMetabolismProfileRepository {
    return this._metabolismProfileRepository;
  }

  get effectiveGoalsRepository(): InMemoryEffectiveGoalsRepository {
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

  get deleteFoodEntryUseCase(): DeleteFoodEntryUseCase {
    return this._deleteFoodEntryUseCase;
  }

  get enrichFoodEntryMacrosUseCase(): EnrichFoodEntryMacrosUseCase {
    return this._enrichFoodEntryMacrosUseCase;
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
}

// Singleton-Instanz erstellen
const container = new Container();

// Container exportieren
export default container;