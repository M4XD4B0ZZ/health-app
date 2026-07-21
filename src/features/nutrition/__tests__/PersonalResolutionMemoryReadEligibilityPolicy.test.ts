import { eligibilityForLevel } from '../application/services/PersonalResolutionMemoryReadEligibilityPolicy';

describe('RESOLVER-V3-019 PersonalResolutionMemoryReadEligibilityPolicy', () => {
  it('P2_confirmed is eligible for deterministic reuse and is preferred', () => {
    expect(eligibilityForLevel('P2_confirmed')).toEqual({
      deterministicReuse: true,
      preferred: true,
    });
  });

  it('P1_provisional may be preferred but is never deterministically reused', () => {
    expect(eligibilityForLevel('P1_provisional')).toEqual({
      deterministicReuse: false,
      preferred: true,
    });
  });

  it('P0_observed is never eligible for reuse or preference (MUST NOT aggressively transfer)', () => {
    expect(eligibilityForLevel('P0_observed')).toEqual({
      deterministicReuse: false,
      preferred: false,
    });
  });
});
