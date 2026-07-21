import type {
  PersonalResolutionMemoryLevel,
  PersonalResolutionMemoryStatus,
} from './PersonalResolutionMemory';

export const PERSONAL_RESOLUTION_MEMORY_INVALIDATION_CONTRACT_VERSION =
  'personal-resolution-memory-invalidation-v1' as const;
export const PERSONAL_RESOLUTION_MEMORY_INVALIDATION_REASONS = [
  'user_correction',
  'explicit_user_delete',
  'source_superseded',
  'source_unavailable',
  'source_identity_changed',
  'contradiction',
  'dependency_invalidated',
  'rollback',
  'account_deletion',
] as const;
export type PersonalResolutionMemoryInvalidationReason =
  (typeof PERSONAL_RESOLUTION_MEMORY_INVALIDATION_REASONS)[number];
export type PersonalResolutionMemoryInvalidationStatus =
  | 'invalidated'
  | 'weakened'
  | 'already_inactive'
  | 'not_found'
  | 'blocked_owner_mismatch'
  | 'invalid_request'
  | 'failed';
export type PersonalResolutionMemoryInvalidationErrorCode =
  | 'unknown_contract_version'
  | 'unknown_reason'
  | 'missing_owner'
  | 'missing_memory_id'
  | 'owner_mismatch'
  | 'cycle_detected'
  | 'traversal_limit_exceeded'
  | 'invalid_dependency'
  | 'atomic_commit_failed'
  | 'repository_failed';

export interface PersonalResolutionMemoryInvalidationRequest {
  contractVersion: string;
  ownerId: string;
  memoryId: string;
  actionId: string;
  reason: string;
  occurredAt: string;
}
export interface PersonalResolutionMemoryInvalidationEvent {
  contractVersion: typeof PERSONAL_RESOLUTION_MEMORY_INVALIDATION_CONTRACT_VERSION;
  eventId: string;
  actionId: string;
  memoryId: string;
  reason: PersonalResolutionMemoryInvalidationReason;
  previousStatus: PersonalResolutionMemoryStatus;
  nextStatus: PersonalResolutionMemoryStatus;
  previousLevel: PersonalResolutionMemoryLevel;
  nextLevel: PersonalResolutionMemoryLevel;
  occurredAt: string;
}
export interface PersonalResolutionMemoryInvalidationResult {
  status: PersonalResolutionMemoryInvalidationStatus;
  code?: PersonalResolutionMemoryInvalidationErrorCode;
  affectedMemoryIds: string[];
}

/**
 * Plan-then-commit contract (RESOLVER-V3-027): the full reachable dependency graph is read and
 * classified into an immutable, deterministic plan before any write. Only the atomic repository
 * commit phase may mutate state, and it applies every entry in one all-or-nothing operation.
 */
export type PersonalResolutionMemoryInvalidationPlanClassification = 'write' | 'noop';

export interface PersonalResolutionMemoryInvalidationPlanEntry {
  memoryId: string;
  reason: PersonalResolutionMemoryInvalidationReason;
  previousStatus: PersonalResolutionMemoryStatus;
  previousLevel: PersonalResolutionMemoryLevel;
  nextStatus: PersonalResolutionMemoryStatus;
  nextLevel: PersonalResolutionMemoryLevel;
  classification: PersonalResolutionMemoryInvalidationPlanClassification;
  event: PersonalResolutionMemoryInvalidationEvent | null;
}

export interface PersonalResolutionMemoryInvalidationPlan {
  contractVersion: typeof PERSONAL_RESOLUTION_MEMORY_INVALIDATION_CONTRACT_VERSION;
  actionId: string;
  ownerId: string;
  rootMemoryId: string;
  occurredAt: string;
  entries: PersonalResolutionMemoryInvalidationPlanEntry[];
  result: PersonalResolutionMemoryInvalidationResult;
}
