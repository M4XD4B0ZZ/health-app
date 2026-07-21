import type { PersonalResolutionMemory } from '../../domain/models/PersonalResolutionMemory';
import type { PersonalResolutionMemoryInvalidationEvent } from '../../domain/models/PersonalResolutionMemoryInvalidation';
import type {
  PersonalResolutionMemoryInvalidationRepository,
  PersonalResolutionMemoryLookup,
} from '../../application/ports/PersonalResolutionMemoryInvalidationRepository';

export class InMemoryPersonalResolutionMemoryInvalidationRepository implements PersonalResolutionMemoryInvalidationRepository {
  readonly events: PersonalResolutionMemoryInvalidationEvent[] = [];
  private readonly memories = new Map<
    string,
    { ownerId: string; memory: PersonalResolutionMemory }
  >();
  private readonly dependencies = new Map<string, string[]>();
  seed(ownerId: string, memory: PersonalResolutionMemory, dependsOn: string[] = []): void {
    this.memories.set(memory.memoryId, { ownerId, memory });
    this.dependencies.set(memory.memoryId, dependsOn);
  }
  async findForInvalidation(
    ownerId: string,
    memoryId: string,
  ): Promise<PersonalResolutionMemoryLookup> {
    const found = this.memories.get(memoryId);
    return !found
      ? { kind: 'not_found' }
      : found.ownerId !== ownerId
        ? { kind: 'owner_mismatch' }
        : { kind: 'found', memory: found.memory };
  }
  async findDependents(ownerId: string, memoryId: string): Promise<string[]> {
    return [...this.dependencies.entries()]
      .filter(
        ([id, parents]) => parents.includes(memoryId) && this.memories.get(id)?.ownerId === ownerId,
      )
      .map(([id]) => id);
  }
  async applyInvalidation(
    ownerId: string,
    memory: PersonalResolutionMemory,
    event: PersonalResolutionMemoryInvalidationEvent,
  ): Promise<'written' | 'duplicate' | 'failed'> {
    if (this.events.some((item) => item.eventId === event.eventId)) return 'duplicate';
    const found = this.memories.get(memory.memoryId);
    if (!found || found.ownerId !== ownerId) return 'failed';
    this.memories.set(memory.memoryId, {
      ownerId,
      memory: { ...memory, updatedAt: event.occurredAt },
    });
    this.events.push(event);
    return 'written';
  }
}
