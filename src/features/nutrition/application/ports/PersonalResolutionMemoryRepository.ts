import type {
  PersonalResolutionMemory,
  PersonalResolutionMemoryEvidence,
  PersonalResolutionMemoryTransition,
  PersonalResolutionNegativeEvidence,
} from '../../domain/models/PersonalResolutionMemory';
export type PersonalResolutionMemoryRecordOutcome = 'written' | 'duplicate' | 'failed';

/** Private owner-scoped write boundary. It deliberately has no resolver read API. */
export interface PersonalResolutionMemoryRepository {
  record(
    ownerId: string,
    memory: PersonalResolutionMemory,
    evidence: PersonalResolutionMemoryEvidence,
    transition: PersonalResolutionMemoryTransition,
    negativeEvidence?: PersonalResolutionNegativeEvidence,
  ): Promise<PersonalResolutionMemoryRecordOutcome>;
}

/** Test/no-network fallback: pretends every write succeeds without persisting anything. */
export class NoopPersonalResolutionMemoryRepository implements PersonalResolutionMemoryRepository {
  async record(): Promise<PersonalResolutionMemoryRecordOutcome> {
    return 'written';
  }
}
