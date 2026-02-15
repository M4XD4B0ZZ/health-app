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

  /**
   * Globales Resolver Budget in Millisekunden
   *
   * Maximale Zeit für den gesamten Resolver-Aufruf (alle Sources).
   * Wenn überschritten, wird der Resolver abgebrochen.
   *
   * @default 1500
   */
  resolverBudgetMs: number

  /**
   * Per-Source Budget in Millisekunden
   *
   * Maximale Zeit pro Source. Key ist source.type ('off', 'usda', etc.)
   *
   * @default { off: 700, usda: 700 }
   */
  sourceBudgets: Record<string, number>

  /**
   * Negative Cache TTL in Millisekunden
   *
   * Wie lange sollen leere Ergebnisse gecacht werden (für normalizedQuery + locale)?
   * Dies verhindert wiederholte teure API-Aufrufe für Queries ohne Treffer.
   *
   * @default 1200000 (20 Minuten)
   */
  negativeCacheTtlMs: number

  /**
   * Circuit Breaker Konfiguration
   */
  circuitBreaker: {
    /**
     * Anzahl aufeinanderfolgender Fehler bevor Circuit öffnet
     * @default 3
     */
    failureThreshold: number

    /**
     * Cooldown-Zeit in Millisekunden bevor Circuit wieder geschlossen wird
     * @default 120000 (2 Minuten)
     */
    cooldownMs: number

    /**
     * Circuit Breaker aktivieren
     * @default true
     */
    enabled: boolean
  }
}

/**
 * Standard-Konfiguration für Food Catalog
 */
export const DEFAULT_CATALOG_CONFIG: FoodCatalogConfig = {
  offEarlyReturnMinConfidence: 0.7,
  enableDebugLogs: typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development',
  enableTracing: true,
  resolverBudgetMs: 1500,
  sourceBudgets: {
    off: 700,
    usda: 700,
  },
  negativeCacheTtlMs: 1200000, // 20 minutes
  circuitBreaker: {
    failureThreshold: 3,
    cooldownMs: 120000, // 2 minutes
    enabled: true,
  },
}
