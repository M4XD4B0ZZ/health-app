import {
  PERSONAL_RESOLUTION_MEMORY_READ_CONTRACT_VERSION as VERSION,
  type PersonalResolutionMemoryReadErrorCode,
  type PersonalResolutionMemoryReadMatch,
  type PersonalResolutionMemoryReadResult,
  type ReadPersonalResolutionMemoryRequest,
} from '../../domain/models/PersonalResolutionMemoryRead';
import { eligibilityForLevel } from '../services/PersonalResolutionMemoryReadEligibilityPolicy';
import type { PersonalResolutionMemoryReadRepository } from '../ports/PersonalResolutionMemoryReadRepository';

function scopeKeyFor(target: { sourceType: string; sourceId: string }): string {
  return `${target.sourceType}:${target.sourceId}`;
}

/**
 * RESOLVER-V3-019: the production read boundary for RESOLVER-V3-017's private memory store.
 * Exact-match only (scope keys are `${sourceType}:${sourceId}` pairs the caller already
 * independently found — never a raw query string), owner-scoped, and fails closed: no owner, an
 * unknown contract version, an empty target list, or a repository error/throw all return an
 * empty match set rather than ever surfacing an exception to a resolver hot path.
 */
export class ReadPersonalResolutionMemoryUseCase {
  constructor(private readonly repository: PersonalResolutionMemoryReadRepository) {}

  async execute(
    request: ReadPersonalResolutionMemoryRequest,
  ): Promise<PersonalResolutionMemoryReadResult> {
    if (request.contractVersion !== VERSION) return invalid('unknown_contract_version');
    if (!request.ownerId) return invalid('missing_owner');
    if (!request.targets || request.targets.length === 0) return invalid('no_targets');

    const scopeKeyToTarget = new Map<string, { sourceType: string; sourceId: string }>();
    for (const target of request.targets) {
      if (!target.sourceType || !target.sourceId) continue;
      scopeKeyToTarget.set(scopeKeyFor(target), target);
    }
    if (scopeKeyToTarget.size === 0) return invalid('no_targets');

    try {
      const rows = await this.repository.findActiveByScopeKeys(
        request.ownerId,
        Array.from(scopeKeyToTarget.keys()),
      );

      const matches: PersonalResolutionMemoryReadMatch[] = [];
      for (const row of rows) {
        const target = scopeKeyToTarget.get(row.scopeKey);
        if (!target) continue; // defense in depth: never trust a row outside the requested set
        matches.push({
          memoryId: row.memoryId,
          sourceType: target.sourceType,
          sourceId: target.sourceId,
          level: row.level,
          eligibility: eligibilityForLevel(row.level),
        });
      }

      return { status: 'ok', matches };
    } catch {
      return { status: 'failed', matches: [] };
    }
  }
}

function invalid(code: PersonalResolutionMemoryReadErrorCode): PersonalResolutionMemoryReadResult {
  return { status: code === 'missing_owner' ? 'no_owner' : 'invalid_request', code, matches: [] };
}
