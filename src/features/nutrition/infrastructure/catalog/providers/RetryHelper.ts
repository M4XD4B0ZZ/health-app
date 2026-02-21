import { FoodCatalogError } from '../../../domain/errors/FoodCatalogError';

/**
 * Retry-Konfiguration für Food Catalog Provider
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 2000,
  backoffMultiplier: 2,
};

/**
 * Prüft, ob ein FoodCatalogError retry-fähig ist.
 *
 * Nur network, edge und rate_limit Fehler sollten wiederholt werden.
 * invalid_payload Fehler deuten auf strukturelle Probleme hin und sollten nicht wiederholt werden.
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof FoodCatalogError)) {
    return false;
  }

  // Nur bei diesen Fehlerarten retry durchführen
  return error.kind === 'network' || error.kind === 'edge' || error.kind === 'rate_limit';
}

/**
 * Wartet für eine bestimmte Zeit mit exponential backoff
 */
async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Führt eine Funktion mit Retry-Logik aus.
 *
 * Nur Fehler vom Typ FoodCatalogError mit kind 'network', 'edge' oder 'rate_limit'
 * werden wiederholt. Andere Fehler werden sofort geworfen.
 *
 * @param fn Die auszuführende Funktion
 * @param config Retry-Konfiguration
 * @param context Context für Logging (z.B. Provider-Name)
 * @returns Das Ergebnis der Funktion
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context?: { name: string; traceId?: string },
): Promise<T> {
  let lastError: unknown;
  let currentDelay = config.initialDelayMs;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Prüfe, ob Fehler retry-fähig ist
      if (!isRetryableError(error)) {
        // Nicht-retryable Fehler sofort werfen
        throw error;
      }

      // Wenn wir am letzten Versuch sind, werfe den Fehler
      if (attempt === config.maxRetries) {
        break;
      }

      // Log retry attempt (nur in development)
      if (typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development') {
        console.debug('[RetryHelper] Retrying after error', {
          context: context?.name,
          traceId: context?.traceId,
          attempt: attempt + 1,
          maxRetries: config.maxRetries,
          errorKind: error instanceof FoodCatalogError ? error.kind : 'unknown',
          delayMs: currentDelay,
        });
      }

      // Warte vor dem nächsten Versuch
      await delay(currentDelay);

      // Erhöhe Delay für nächsten Versuch (exponential backoff)
      currentDelay = Math.min(currentDelay * config.backoffMultiplier, config.maxDelayMs);
    }
  }

  // Alle Versuche sind fehlgeschlagen
  throw lastError;
}
