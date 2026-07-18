import { SavedMealTemplate } from '../../domain/models/SavedMealTypes';

/**
 * Port für SavedMealTemplate-Persistierung.
 * Ermöglicht das Speichern, Abrufen und Löschen von Mahlzeit-Vorlagen.
 */
export interface SavedMealRepository {
  /**
   * Erstellt eine neue SavedMealTemplate.
   */
  create(template: SavedMealTemplate): Promise<void>;

  /**
   * Gibt alle aktiven (nicht tombstoned) Mahlzeit-Vorlagen zurück.
   */
  list(): Promise<SavedMealTemplate[]>;

  /**
   * Lädt eine spezifische aktive Vorlage anhand ihrer ID.
   * Gibt null zurück, wenn nicht gefunden oder soft-deleted.
   */
  getById(id: string): Promise<SavedMealTemplate | null>;

  /**
   * ACC-002: soft-delete — sets the tombstone (`deletedAt`) instead of physically
   * removing the template. A no-op if the id is unknown or already tombstoned
   * (idempotent — repeated calls never rewrite an existing `deletedAt`).
   */
  delete(id: string, deletedAt: Date): Promise<void>;

  /**
   * SM-003: Aktualisiert eine bestehende Vorlage (z.B. Umbenennen). Ersetzt den
   * gespeicherten Stand vollständig anhand von `template.id`; kein Merge-Verhalten.
   */
  update(template: SavedMealTemplate): Promise<void>;

  /**
   * ACC-002: returns every template, active or tombstoned. For future sync/diagnostic
   * infrastructure only — ordinary product use cases must use `list()` instead.
   */
  listIncludingDeleted(): Promise<SavedMealTemplate[]>;

  /**
   * ACC-002: direct lookup by id that ignores the tombstone. For future sync/diagnostic
   * infrastructure only — ordinary product use cases must use `getById()` instead.
   */
  getByIdIncludingDeleted(id: string): Promise<SavedMealTemplate | null>;
}
