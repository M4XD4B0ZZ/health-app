/**
 * Konfiguration für Food Catalog Resolver und Sources
 * 
 * Diese Konfiguration erlaubt es, Schwellwerte und Verhalten
 * des Catalog-Systems anzupassen, ohne Code zu ändern.
 */
export interface FoodCatalogConfig {
  /**
   * Minimum Confidence für OFF Early Return
   * 
   * Wenn OFF-Quelle einen Match mit dieser oder höherer Confidence liefert,
   * wird sofort zurückgekehrt ohne USDA zu befragen.
   * 
   * @default 0.7
   */
  offEarlyReturnMinConfidence: number

  /**
   * Debug-Logging aktivieren
   * 
   * Wenn true, werden detaillierte Logs für alle Catalog-Operationen ausgegeben.
   * In Production sollte dies false sein.
   * 
   * @default __DEV__ or process.env.NODE_ENV === 'development'
   */
  enableDebugLogs: boolean

  /**
   * Trace-IDs für Request-Tracking aktivieren
   * 
   * Wenn true, wird jeder Lookup mit einer eindeutigen traceId versehen,
   * die durch alle Sources propagiert wird.
   * 
   * @default true
   */
  enableTracing: boolean
}

/**
 * Standard-Konfiguration für Food Catalog
 */
export const DEFAULT_CATALOG_CONFIG: FoodCatalogConfig = {
  offEarlyReturnMinConfidence: 0.7,
  enableDebugLogs: typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development',
  enableTracing: true,
}
