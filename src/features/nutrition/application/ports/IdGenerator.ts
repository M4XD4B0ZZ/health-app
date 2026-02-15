/**
 * Port für ID-Generierung.
 * Ermöglicht deterministische Tests durch Injektion eines Test-Generators.
 */
export interface IdGenerator {
  /**
   * Generiert eine neue eindeutige ID.
   */
  newId(): string;
}
