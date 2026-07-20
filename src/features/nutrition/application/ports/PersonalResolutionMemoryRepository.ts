import type {
  PersonalResolutionMemory,
  PersonalResolutionMemoryEvidence,
  PersonalResolutionMemoryTransition,
  PersonalResolutionNegativeEvidence,
} from '../../domain/models/PersonalResolutionMemory';
/** Private owner-scoped write boundary. It deliberately has no resolver read API. */
export interface PersonalResolutionMemoryRepository {
  record(
    ownerId: string,
    memory: PersonalResolutionMemory,
    evidence: PersonalResolutionMemoryEvidence,
    transition: PersonalResolutionMemoryTransition,
    negativeEvidence?: PersonalResolutionNegativeEvidence,
  ): Promise<'written' | 'duplicate'>;
}
