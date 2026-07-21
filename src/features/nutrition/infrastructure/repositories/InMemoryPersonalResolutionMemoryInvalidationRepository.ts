import type { PersonalResolutionMemory } from '../../domain/models/PersonalResolutionMemory';
import type {
  PersonalResolutionMemoryInvalidationEvent,
  PersonalResolutionMemoryInvalidationPlan,
  PersonalResolutionMemoryInvalidationResult,
} from '../../domain/models/PersonalResolutionMemoryInvalidation';
import type {
  PersonalResolutionMemoryInvalidationCommitOutcome,
  PersonalResolutionMemoryInvalidationRepository,
  PersonalResolutionMemoryLookup,
} from '../../application/ports/PersonalResolutionMemoryInvalidationRepository';

type StoredMemory = { ownerId: string; memory: PersonalResolutionMemory };

/**
 * Contract-conformant in-memory adapter for RESOLVER-V3-027's plan-then-commit invalidation port.
 *
 * `applyInvalidationPlanAtomically` stages every write against copies of the internal maps and only
 * swaps them into the live state after the entire plan has been applied without error, so a failure
 * at any point (including one injected via `injectCommitFailureAtWriteIndex` for tests) leaves the
 * previously observable state and event history completely unchanged. This is the only production
 * adapter for this port in the repository; no Supabase adapter exists yet (see the invalidation
 * contract doc for the documented persistence boundary).
 */
export class InMemoryPersonalResolutionMemoryInvalidationRepository implements PersonalResolutionMemoryInvalidationRepository {
  private memories = new Map<string, StoredMemory>();
  private readonly dependencies = new Map<string, string[]>();
  private eventLog: PersonalResolutionMemoryInvalidationEvent[] = [];
  private readonly committedActions = new Map<string, PersonalResolutionMemoryInvalidationResult>();
  private failWriteIndex: number | null = null;

  get events(): readonly PersonalResolutionMemoryInvalidationEvent[] {
    return this.eventLog;
  }

  seed(ownerId: string, memory: PersonalResolutionMemory, dependsOn: string[] = []): void {
    this.memories.set(memory.memoryId, { ownerId, memory });
    this.dependencies.set(memory.memoryId, dependsOn);
  }

  /** Test-only failure injection: throws while applying the write at this 0-based index of the
   * plan's write-classified entries, then resets so a subsequent commit call succeeds normally. */
  injectCommitFailureAtWriteIndex(index: number): void {
    this.failWriteIndex = index;
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

  async findCommittedAction(
    ownerId: string,
    actionId: string,
  ): Promise<PersonalResolutionMemoryInvalidationResult | null> {
    return this.committedActions.get(ledgerKey(ownerId, actionId)) ?? null;
  }

  async applyInvalidationPlanAtomically(
    plan: PersonalResolutionMemoryInvalidationPlan,
  ): Promise<PersonalResolutionMemoryInvalidationCommitOutcome> {
    const key = ledgerKey(plan.ownerId, plan.actionId);
    if (this.committedActions.has(key)) return 'duplicate';

    const stagedMemories = new Map(this.memories);
    const stagedEvents = [...this.eventLog];
    const injectedFailureIndex = this.failWriteIndex;
    this.failWriteIndex = null;

    try {
      let writeIndex = 0;
      for (const entry of plan.entries) {
        if (entry.classification !== 'write' || !entry.event) continue;
        if (injectedFailureIndex !== null && writeIndex === injectedFailureIndex) {
          throw new Error('injected commit failure');
        }
        const current = stagedMemories.get(entry.memoryId);
        if (!current || current.ownerId !== plan.ownerId) throw new Error('staged memory missing');
        stagedMemories.set(entry.memoryId, {
          ownerId: plan.ownerId,
          memory: {
            ...current.memory,
            status: entry.nextStatus,
            level: entry.nextLevel,
            updatedAt: entry.event.occurredAt,
          },
        });
        stagedEvents.push(entry.event);
        writeIndex += 1;
      }
      this.memories = stagedMemories;
      this.eventLog = stagedEvents;
      this.committedActions.set(key, plan.result);
      return 'applied';
    } catch {
      return 'failed';
    }
  }
}

function ledgerKey(ownerId: string, actionId: string): string {
  return `${ownerId}:${actionId}`;
}
