import { MetabolismProfile } from "../domain/models/MetabolismTypes"
import { MetabolismProfileRepository } from "../application/ports"

/**
 * In-memory implementation of MetabolismProfileRepository
 * Stores a single profile (only one profile per user)
 */
export class InMemoryMetabolismProfileRepository implements MetabolismProfileRepository {
  private profile: MetabolismProfile | null = null

  async get(): Promise<MetabolismProfile | null> {
    return this.profile
  }

  async upsert(profile: MetabolismProfile): Promise<void> {
    this.profile = profile
  }

  // Helper for testing
  clear(): void {
    this.profile = null
  }
}
