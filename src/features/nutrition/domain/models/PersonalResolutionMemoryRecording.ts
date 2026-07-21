import type {
  PersonalResolutionMemoryLevel,
  PersonalResolutionMemoryTarget,
} from './PersonalResolutionMemory';

export const PERSONAL_RESOLUTION_MEMORY_RECORDING_CONTRACT_VERSION =
  'personal-resolution-memory-recording-v1' as const;

export type PersonalResolutionMemoryRecordingStatus =
  | 'written'
  | 'duplicate'
  | 'invalid_request'
  | 'failed';

export type PersonalResolutionMemoryRecordingErrorCode =
  | 'unknown_contract_version'
  | 'unknown_evidence_type'
  | 'missing_owner'
  | 'missing_action_id'
  | 'missing_target'
  | 'correction_requires_prior_memory_id';

export interface RecordPersonalResolutionMemoryRequest {
  contractVersion: string;
  ownerId: string;
  /** The single idempotency boundary: retrying the same actionId must never duplicate a
   * memory, an evidence event, a transition event, or a negative-evidence event. */
  actionId: string;
  locale: 'de' | 'en';
  target: PersonalResolutionMemoryTarget;
  evidenceType: string;
  occurredAt: string;
  /** Required only for `explicit_correction`: the memory this correction overrides. Its
   * presence is what lets correction precedence be enforced without inventing intent — a
   * correction with no prior decision to override is a contradiction, not a correction. */
  priorMemoryId?: string;
}

export interface PersonalResolutionMemoryRecordingResult {
  status: PersonalResolutionMemoryRecordingStatus;
  code?: PersonalResolutionMemoryRecordingErrorCode;
  memoryId?: string;
  level?: PersonalResolutionMemoryLevel;
}
