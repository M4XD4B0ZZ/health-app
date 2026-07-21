import type { PersonalResolutionMemory } from '../../domain/models/PersonalResolutionMemory';
import type {
  PersonalResolutionMemoryInvalidationPlan,
  PersonalResolutionMemoryInvalidationResult,
} from '../../domain/models/PersonalResolutionMemoryInvalidation';

export type PersonalResolutionMemoryLookup =
  | { kind: 'found'; memory: PersonalResolutionMemory }
  | { kind: 'not_found' }
  | { kind: 'owner_mismatch' };

export type PersonalResolutionMemoryInvalidationCommitOutcome = 'applied' | 'duplicate' | 'failed';

/**
 * Private mutation boundary. It intentionally exposes neither a resolver lookup nor global access.
 *
 * Plan-then-commit (RESOLVER-V3-027): `findForInvalidation`/`findDependents` are read-only and are
 * used exclusively during planning. `applyInvalidationPlanAtomically` is the only write operation and
 * MUST apply every planned state/event write as one atomic, all-or-nothing unit — a failure partway
 * through must leave the previously observable state and event history completely unchanged. A
 * duplicate `actionId` MUST be idempotent: no new state transition, no new audit event.
 */
export interface PersonalResolutionMemoryInvalidationRepository {
  findForInvalidation(ownerId: string, memoryId: string): Promise<PersonalResolutionMemoryLookup>;
  findDependents(ownerId: string, memoryId: string): Promise<string[]>;
  /** Returns the previously committed result for this action ID, or null if it was never committed. */
  findCommittedAction(
    ownerId: string,
    actionId: string,
  ): Promise<PersonalResolutionMemoryInvalidationResult | null>;
  /** Applies the full plan atomically: all writes and the action ledger entry, or none of them. */
  applyInvalidationPlanAtomically(
    plan: PersonalResolutionMemoryInvalidationPlan,
  ): Promise<PersonalResolutionMemoryInvalidationCommitOutcome>;
}
