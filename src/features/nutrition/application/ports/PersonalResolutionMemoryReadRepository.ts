import type { PersonalResolutionMemoryLevel } from '../../domain/models/PersonalResolutionMemory';

export interface PersonalResolutionMemoryReadRow {
  memoryId: string;
  scopeKey: string;
  level: PersonalResolutionMemoryLevel;
}

/**
 * Private owner-scoped read boundary (RESOLVER-V3-019). Deliberately narrow: exact scope-key
 * lookup only, must return only currently `active` rows (invalidated/superseded/contradicted/
 * deleted memories are never eligible — RESOLVER-V3-018/027 own re-activation and this port
 * MUST NOT re-enable them), and must fail closed (empty result, never a thrown error escaping
 * to a caller) so a lookup failure can never turn into a resolution failure.
 */
export interface PersonalResolutionMemoryReadRepository {
  findActiveByScopeKeys(
    ownerId: string,
    scopeKeys: string[],
  ): Promise<PersonalResolutionMemoryReadRow[]>;
}

/** Test/no-network fallback: always reports no memory, never persists or reads anything. */
export class NoopPersonalResolutionMemoryReadRepository implements PersonalResolutionMemoryReadRepository {
  async findActiveByScopeKeys(): Promise<PersonalResolutionMemoryReadRow[]> {
    return [];
  }
}
