import {
  PERSONAL_RESOLUTION_MEMORY_CONTRACT_VERSION,
  PERSONAL_RESOLUTION_MEMORY_EVIDENCE_TYPES,
  type PersonalResolutionMemoryEvidenceType,
  type PersonalResolutionMemoryLevel,
} from '../../domain/models/PersonalResolutionMemory';
export function promotionForEvidence(
  version: string,
  evidence: string,
): PersonalResolutionMemoryLevel {
  if (version !== PERSONAL_RESOLUTION_MEMORY_CONTRACT_VERSION)
    throw new Error('PERSONAL_MEMORY_UNKNOWN_CONTRACT_VERSION');
  if (!(PERSONAL_RESOLUTION_MEMORY_EVIDENCE_TYPES as readonly string[]).includes(evidence))
    throw new Error('PERSONAL_MEMORY_UNKNOWN_EVIDENCE');
  switch (evidence as PersonalResolutionMemoryEvidenceType) {
    case 'deliberate_candidate_selection':
      return 'P1_provisional';
    case 'explicit_confirmation':
    case 'explicit_correction':
    case 'deliberately_saved_personal_meal':
    case 'manual_personal_definition':
      return 'P2_confirmed';
    default:
      return 'P0_observed';
  }
}
