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
    return Array.from(this.templates.values()).filter((template) => !template.deletedAt);
  }

  async getById(id: string): Promise<SavedMealTemplate | null> {
    const found = this.templates.get(id);
    return found && !found.deletedAt ? found : null;
  }

  /** ACC-002: soft-delete — no-op if unknown or already tombstoned (idempotent). */
  async delete(id: string, deletedAt: Date): Promise<void> {
    const existing = this.templates.get(id);
    if (!existing || existing.deletedAt) {
      return;
    }
    this.templates.set(id, { ...existing, deletedAt });
  }

  async update(template: SavedMealTemplate): Promise<void> {
    if (!this.templates.has(template.id)) {
      throw new Error(`SavedMealTemplate with id ${template.id} not found`);
    }
    this.templates.set(template.id, template);
  }

  async listIncludingDeleted(): Promise<SavedMealTemplate[]> {
    return Array.from(this.templates.values());
  }

  async getByIdIncludingDeleted(id: string): Promise<SavedMealTemplate | null> {
    return this.templates.get(id) || null;
  }

  /**
   * Test-Utility: Löscht alle Templates (nur für Tests).
   */
  clear(): void {
    this.templates.clear();
  }
}
