import { FoodCatalogError, FoodCatalogErrorKind } from '../../domain/errors/FoodCatalogError'

/**
 * Circuit Breaker State per Source
 */
interface CircuitState {
  failureCount: number
  lastFailureAt: number | null
  openUntil: number | null
}

/**
 * Circuit Breaker Manager
 * 
 * Verwaltet Circuit Breaker State pro Source (OFF, USDA, etc.)
 * 
 * - Track failureCount, lastFailureAt, openUntil
 * - Wenn Circuit open: Source sofort skippen
 * - Bei Success: failureCount resetten und Circuit schließen
 * - Fehler zählen nur für FoodCatalogError.kind in: network|edge|rate_limit|timeout
 */
export class CircuitBreakerManager {
  private circuits = new Map<string, CircuitState>()

  constructor(
    private readonly failureThreshold: number,
    private readonly cooldownMs: number,
    private readonly enabled: boolean,
  ) {}

  /**
   * Prüft ob Circuit für eine Source offen ist
   * 
   * @returns true wenn Circuit offen ist (Source sollte geskippt werden)
   */
  isOpen(sourceType: string): boolean {
    if (!this.enabled) {
      return false
    }

    const state = this.getOrCreateState(sourceType)
    const now = Date.now()

    // Circuit ist offen und Cooldown ist noch nicht abgelaufen
    if (state.openUntil !== null && now < state.openUntil) {
      return true
    }

    // Cooldown ist abgelaufen, Circuit schließen
    if (state.openUntil !== null && now >= state.openUntil) {
      this.reset(sourceType)
      return false
    }

    return false
  }

  /**
   * Registriert einen Erfolg für eine Source
   * 
   * Reset failureCount und schließt Circuit
   */
  recordSuccess(sourceType: string): void {
    if (!this.enabled) {
      return
    }

    this.reset(sourceType)
  }

  /**
   * Registriert einen Fehler für eine Source
   * 
   * Zählt nur Fehler mit kind in: network|edge|rate_limit|timeout
   * Öffnet Circuit wenn failureThreshold erreicht wird
   * 
   * @returns true wenn Circuit jetzt offen ist
   */
  recordFailure(sourceType: string, error: unknown): boolean {
    if (!this.enabled) {
      return false
    }

    // Nur zählbare Fehler berücksichtigen
    if (!this.isCountableError(error)) {
      return false
    }

    const state = this.getOrCreateState(sourceType)
    const now = Date.now()

    state.failureCount++
    state.lastFailureAt = now

    // Circuit öffnen wenn Threshold erreicht
    if (state.failureCount >= this.failureThreshold) {
      state.openUntil = now + this.cooldownMs
      return true
    }

    return false
  }

  /**
   * Gibt aktuellen State für Logging/Observability zurück
   */
  getState(sourceType: string): {
    failureCount: number
    lastFailureAt: number | null
    openUntil: number | null
    circuitOpen: boolean
  } {
    const state = this.getOrCreateState(sourceType)
    return {
      failureCount: state.failureCount,
      lastFailureAt: state.lastFailureAt,
      openUntil: state.openUntil,
      circuitOpen: this.isOpen(sourceType),
    }
  }

  /**
   * Reset Circuit für eine Source
   */
  reset(sourceType: string): void {
    this.circuits.set(sourceType, {
      failureCount: 0,
      lastFailureAt: null,
      openUntil: null,
    })
  }

  /**
   * Reset alle Circuits (für Tests)
   */
  resetAll(): void {
    this.circuits.clear()
  }

  private getOrCreateState(sourceType: string): CircuitState {
    if (!this.circuits.has(sourceType)) {
      this.circuits.set(sourceType, {
        failureCount: 0,
        lastFailureAt: null,
        openUntil: null,
      })
    }
    return this.circuits.get(sourceType)!
  }

  /**
   * Prüft ob Fehler für Circuit Breaker zählt
   *
   * Nur network|edge|rate_limit|timeout zählen, nicht invalid_payload
   */
  isCountableError(error: unknown): boolean {
    if (!(error instanceof FoodCatalogError)) {
      return false
    }

    const countableKinds: FoodCatalogErrorKind[] = [
      'network',
      'edge',
      'rate_limit',
      'timeout',
    ]

    return countableKinds.includes(error.kind)
  }
}
