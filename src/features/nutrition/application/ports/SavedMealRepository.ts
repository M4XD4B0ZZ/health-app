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
   * Gibt alle gespeicherten Mahlzeit-Vorlagen zurück.
   */
  list(): Promise<SavedMealTemplate[]>;

  /**
   * Lädt eine spezifische Vorlage anhand ihrer ID.
   * Gibt null zurück, wenn nicht gefunden.
   */
  getById(id: string): Promise<SavedMealTemplate | null>;

  /**
   * Löscht eine Vorlage anhand ihrer ID.
   */
  delete(id: string): Promise<void>;

  /**
   * SM-003: Aktualisiert eine bestehende Vorlage (z.B. Umbenennen). Ersetzt den
   * gespeicherten Stand vollständig anhand von `template.id`; kein Merge-Verhalten.
   */
  update(template: SavedMealTemplate): Promise<void>;
}
