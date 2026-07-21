import { promotionForEvidence } from '../application/services/PersonalResolutionMemoryPromotionPolicy';
describe('PersonalResolutionMemoryPromotionPolicy', () => {
  const v = 'personal-resolution-memory-v1';
  it.each([
    ['logged_without_explicit_confirmation', 'P0_observed'],
    ['repeated_source_grounded_use', 'P0_observed'],
    ['deliberate_candidate_selection', 'P1_provisional'],
    ['explicit_confirmation', 'P2_confirmed'],
    ['explicit_correction', 'P2_confirmed'],
    ['deliberately_saved_personal_meal', 'P2_confirmed'],
  ])('%s promotes to %s', (e, level) => expect(promotionForEvidence(v, e)).toBe(level));
  it('fails closed for unknown evidence and contract', () => {
    expect(() => promotionForEvidence(v, 'anything')).toThrow('PERSONAL_MEMORY_UNKNOWN_EVIDENCE');
    expect(() => promotionForEvidence('v2', 'explicit_confirmation')).toThrow(
      'PERSONAL_MEMORY_UNKNOWN_CONTRACT_VERSION',
    );
  });
});
