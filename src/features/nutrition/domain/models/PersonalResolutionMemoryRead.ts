import type { PersonalResolutionMemoryLevel } from './PersonalResolutionMemory';

export const PERSONAL_RESOLUTION_MEMORY_READ_CONTRACT_VERSION =
  'personal-resolution-memory-read-v1' as const;

/**
 * RESOLVER-V3-019: exact-match read boundary. A target is the same `{sourceType, sourceId}`
 * pair the write path (RESOLVER-V3-026) already records against — never a raw query string, so
 * this can never "aggressively transfer" a memory to a merely similar input (forbidden by the
 * Decision Record). The resolver only ever supplies targets it already independently found.
 */
export interface PersonalResolutionMemoryReadTarget {
  sourceType: string;
  sourceId: string;
}

/**
 * What a caller may deterministically do with a returned match. Derived purely from the
 * memory's level by `PersonalResolutionMemoryReadEligibilityPolicy` — never invented per call
 * site. `P0_observed` never appears here as eligible for anything (it is intentionally excluded
 * before this shape is built): the Decision Record forbids treating weak/observed evidence as
 * reusable.
 */
export interface PersonalResolutionMemoryReadEligibility {
  /** P2_confirmed only: may be deterministically reused for this owner and may avoid an AI call. */
  deterministicReuse: boolean;
  /** P1_provisional or P2_confirmed: may be preferred, but must remain visibly correctable. */
  preferred: boolean;
}

export interface PersonalResolutionMemoryReadMatch {
  memoryId: string;
  sourceType: string;
  sourceId: string;
  level: PersonalResolutionMemoryLevel;
  eligibility: PersonalResolutionMemoryReadEligibility;
}

export type PersonalResolutionMemoryReadStatus = 'ok' | 'no_owner' | 'invalid_request' | 'failed';

export type PersonalResolutionMemoryReadErrorCode =
  | 'unknown_contract_version'
  | 'missing_owner'
  | 'no_targets';

export interface ReadPersonalResolutionMemoryRequest {
  contractVersion: string;
  ownerId: string;
  targets: PersonalResolutionMemoryReadTarget[];
}

export interface PersonalResolutionMemoryReadResult {
  status: PersonalResolutionMemoryReadStatus;
  code?: PersonalResolutionMemoryReadErrorCode;
  matches: PersonalResolutionMemoryReadMatch[];
}
