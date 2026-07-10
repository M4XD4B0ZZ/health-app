import { SavedMealTemplate } from '../../domain/models/SavedMealTypes';
import { SavedMealRepository } from '../../application/ports/SavedMealRepository';

/**
 * In-Memory Implementierung des SavedMealRepository.
 * Speichert SavedMealTemplates in einer Map nach ID.
 */
export class InMemorySavedMealRepository implements SavedMealRepository {
  private templates: Map<string, SavedMealTemplate> = new Map();

  async create(template: SavedMealTemplate): Promise<void> {
    this.templates.set(template.id, template);
  }

  async list(): Promise<SavedMealTemplate[]> {
    return Array.from(this.templates.values());
  }

  async getById(id: string): Promise<SavedMealTemplate | null> {
    return this.templates.get(id) || null;
  }

  async delete(id: string): Promise<void> {
    this.templates.delete(id);
  }

  async update(template: SavedMealTemplate): Promise<void> {
    if (!this.templates.has(template.id)) {
      throw new Error(`SavedMealTemplate with id ${template.id} not found`);
    }
    this.templates.set(template.id, template);
  }

  /**
   * Test-Utility: Löscht alle Templates (nur für Tests).
   */
  clear(): void {
    this.templates.clear();
  }
}
