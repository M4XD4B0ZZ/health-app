import type { PersonalResolutionMemory } from '../../domain/models/PersonalResolutionMemory';
import type { PersonalResolutionMemoryInvalidationEvent } from '../../domain/models/PersonalResolutionMemoryInvalidation';

export type PersonalResolutionMemoryLookup =
  | { kind: 'found'; memory: PersonalResolutionMemory }
  | { kind: 'not_found' }
  | { kind: 'owner_mismatch' };
/** Private mutation boundary. It intentionally exposes neither a resolver lookup nor global access. */
export interface PersonalResolutionMemoryInvalidationRepository {
  findForInvalidation(ownerId: string, memoryId: string): Promise<PersonalResolutionMemoryLookup>;
  findDependents(ownerId: string, memoryId: string): Promise<string[]>;
  applyInvalidation(
    ownerId: string,
    memory: PersonalResolutionMemory,
    event: PersonalResolutionMemoryInvalidationEvent,
  ): Promise<'written' | 'duplicate' | 'failed'>;
}
