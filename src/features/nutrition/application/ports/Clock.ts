/**
 * Port für Zeit-Zugriff.
 * Ermöglicht deterministische Tests durch Injektion einer Test-Clock.
 */
export interface Clock {
  /**
   * Gibt das aktuelle Datum/Zeit zurück.
   */
  now(): Date;

  /**
   * Gibt das heutige Datum im ISO-Format zurück (YYYY-MM-DD).
   */
  todayISO(): string;
}
