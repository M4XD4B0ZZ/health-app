import type { PersonalResolutionMemoryLevel } from '../../domain/models/PersonalResolutionMemory';
import type { PersonalResolutionMemoryReadEligibility } from '../../domain/models/PersonalResolutionMemoryRead';

/**
 * RESOLVER-V3-019: the sole place read eligibility is decided, so no call site can invent its
 * own reuse rule. Mirrors the Decision Record §6 verbatim: P0 is weak/re-suggestible only and
 * MUST NOT transfer; P1 MAY be preferred for identical input but MUST remain correctable (no
 * forced override); P2 MAY be deterministically reused and MAY avoid an AI call.
 */
export function eligibilityForLevel(
  level: PersonalResolutionMemoryLevel,
): PersonalResolutionMemoryReadEligibility {
  switch (level) {
    case 'P2_confirmed':
      return { deterministicReuse: true, preferred: true };
    case 'P1_provisional':
      return { deterministicReuse: false, preferred: true };
    case 'P0_observed':
    default:
      return { deterministicReuse: false, preferred: false };
  }
}
