import { RecoveryRepository } from '../../domain/repositories/RecoveryRepository';
import { NutritionRepository } from '../../domain/repositories/NutritionRepository';
import { MockRecoveryRepository } from '../mocks/MockRecoveryRepository';
import { MockNutritionRepository } from '../mocks/MockNutritionRepository';
import { GetDashboardSummary } from '../../application/usecases/GetDashboardSummary';
import { GetNutritionSummary } from '../../application/usecases/GetNutritionSummary';
import { GetRecoverySummary } from '../../application/usecases/GetRecoverySummary';

/**
 * Einfacher Dependency Container für die Anwendung
 * Stellt Repositories und Usecases bereit
 */
class Container {
  // Repositories
  private _recoveryRepository: RecoveryRepository;
  private _nutritionRepository: NutritionRepository;
  
  // Usecases
  private _getDashboardSummary: GetDashboardSummary;
  private _getNutritionSummary: GetNutritionSummary;
  private _getRecoverySummary: GetRecoverySummary;
  
  constructor() {
    // Repositories initialisieren
    this._recoveryRepository = new MockRecoveryRepository();
    this._nutritionRepository = new MockNutritionRepository();
    
    // Usecases initialisieren
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
  
  // Getter für Repositories
  get recoveryRepository(): RecoveryRepository {
    return this._recoveryRepository;
  }
  
  get nutritionRepository(): NutritionRepository {
    return this._nutritionRepository;
  }
  
  // Getter für Usecases
  get getDashboardSummary(): GetDashboardSummary {
    return this._getDashboardSummary;
  }
  
  get getNutritionSummary(): GetNutritionSummary {
    return this._getNutritionSummary;
  }
  
  get getRecoverySummary(): GetRecoverySummary {
    return this._getRecoverySummary;
  }
}

// Singleton-Instanz erstellen
const container = new Container();

// Container exportieren
export default container;