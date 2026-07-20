export const PERSONAL_RESOLUTION_MEMORY_CONTRACT_VERSION = 'personal-resolution-memory-v1' as const;
export type PersonalResolutionMemoryLevel = 'P0_observed' | 'P1_provisional' | 'P2_confirmed';
export type PersonalResolutionMemoryStatus = 'active' | 'superseded' | 'contradicted' | 'deleted';
export const PERSONAL_RESOLUTION_MEMORY_EVIDENCE_TYPES = [
  'logged_without_explicit_confirmation',
  'deliberate_candidate_selection',
  'explicit_confirmation',
  'explicit_correction',
  'deliberately_saved_personal_meal',
  'repeated_source_grounded_use',
  'contradiction',
  'manual_personal_definition',
] as const;
export type PersonalResolutionMemoryEvidenceType =
  (typeof PERSONAL_RESOLUTION_MEMORY_EVIDENCE_TYPES)[number];
export interface PersonalResolutionMemoryTarget {
  sourceType: string;
  sourceId: string;
  kind: 'source_grounded' | 'personal_manual';
}
export interface PersonalResolutionMemory {
  contractVersion: typeof PERSONAL_RESOLUTION_MEMORY_CONTRACT_VERSION;
  memoryId: string;
  locale: 'de' | 'en';
  scopeKey: string;
  target: PersonalResolutionMemoryTarget;
  level: PersonalResolutionMemoryLevel;
  status: PersonalResolutionMemoryStatus;
  createdAt: string;
  updatedAt: string;
  observedAt: string;
  supersedesMemoryId?: string;
  correctionReference?: string;
  resolverVersion?: string;
}
export interface PersonalResolutionMemoryEvidence {
  evidenceId: string;
  memoryId: string;
  type: PersonalResolutionMemoryEvidenceType;
  occurredAt: string;
  actionId: string;
}
export interface PersonalResolutionMemoryTransition {
  transitionId: string;
  memoryId: string;
  previousLevel?: PersonalResolutionMemoryLevel;
  nextLevel: PersonalResolutionMemoryLevel;
  previousStatus?: PersonalResolutionMemoryStatus;
  nextStatus: PersonalResolutionMemoryStatus;
  evidenceId: string;
  occurredAt: string;
}
export interface PersonalResolutionNegativeEvidence {
  negativeEvidenceId: string;
  priorMemoryId: string;
  correctedMemoryId: string;
  reason: 'user_correction';
  correctionReference: string;
  occurredAt: string;
}
