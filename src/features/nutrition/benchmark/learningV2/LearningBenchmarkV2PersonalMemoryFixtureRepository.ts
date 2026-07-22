import type {
  PersonalResolutionMemoryRepository,
  PersonalResolutionMemoryRecordOutcome,
} from '../../application/ports/PersonalResolutionMemoryRepository';
import type {
  PersonalResolutionMemoryReadRepository,
  PersonalResolutionMemoryReadRow,
} from '../../application/ports/PersonalResolutionMemoryReadRepository';
import type {
  PersonalResolutionMemory,
  PersonalResolutionMemoryEvidence,
  PersonalResolutionMemoryTransition,
  PersonalResolutionNegativeEvidence,
} from '../../domain/models/PersonalResolutionMemory';

/**
 * RESOLVER-V3-023 benchmark-only fixture adapter. No production in-memory adapter exists for the
 * write (`PersonalResolutionMemoryRepository`) or read (`PersonalResolutionMemoryReadRepository`)
 * ports today -- only Supabase adapters and inline test-file fakes. This class implements both
 * real port interfaces over one shared, deterministic in-memory store so the benchmark harness can
 * drive the real `RecordPersonalResolutionMemoryUseCase`/`ReadPersonalResolutionMemoryUseCase`
 * without a network. It supplies storage only -- promotion level, eligibility, and evidence-type
 * semantics all remain the real production policy functions' responsibility (called by the real
 * use cases, never reimplemented here).
 */
export class LearningBenchmarkV2PersonalMemoryFixtureRepository
  implements PersonalResolutionMemoryRepository, PersonalResolutionMemoryReadRepository
{
  private readonly rows = new Map<string, { ownerId: string; memory: PersonalResolutionMemory }>();
  readonly recordedEvidence: PersonalResolutionMemoryEvidence[] = [];
  readonly recordedTransitions: PersonalResolutionMemoryTransition[] = [];
  readonly recordedNegativeEvidence: PersonalResolutionNegativeEvidence[] = [];

  async record(
    ownerId: string,
    memory: PersonalResolutionMemory,
    evidence: PersonalResolutionMemoryEvidence,
    transition: PersonalResolutionMemoryTransition,
    negativeEvidence?: PersonalResolutionNegativeEvidence,
  ): Promise<PersonalResolutionMemoryRecordOutcome> {
    if (this.rows.has(memory.memoryId)) return 'duplicate';
    this.rows.set(memory.memoryId, { ownerId, memory });
    this.recordedEvidence.push(evidence);
    this.recordedTransitions.push(transition);
    if (negativeEvidence) this.recordedNegativeEvidence.push(negativeEvidence);
    return 'written';
  }

  async findActiveByScopeKeys(
    ownerId: string,
    scopeKeys: string[],
  ): Promise<PersonalResolutionMemoryReadRow[]> {
    const wanted = new Set(scopeKeys);
    return [...this.rows.values()]
      .filter(
        (row) =>
          row.ownerId === ownerId &&
          row.memory.status === 'active' &&
          wanted.has(row.memory.scopeKey),
      )
      .map((row) => ({
        memoryId: row.memory.memoryId,
        scopeKey: row.memory.scopeKey,
        level: row.memory.level,
      }));
  }

  /** Fixture-only bridge: after `InvalidatePersonalResolutionMemoryUseCase` commits a status/level
   * change via the real `InMemoryPersonalResolutionMemoryInvalidationRepository`, the harness pulls
   * the updated memory back out (`findForInvalidation`) and syncs it here so subsequent reads
   * reflect it. This repository never computes the transition itself. */
  syncFromInvalidation(ownerId: string, memory: PersonalResolutionMemory): void {
    if (this.rows.has(memory.memoryId)) this.rows.set(memory.memoryId, { ownerId, memory });
  }

  getMemoryForTesting(memoryId: string): PersonalResolutionMemory | undefined {
    return this.rows.get(memoryId)?.memory;
  }

  get size(): number {
    return this.rows.size;
  }
}
