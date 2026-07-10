import {
  EvaluationProfile,
  Rule,
  EvaluationInput,
  EvaluationOutput,
} from '../domain/models';

/**
 * GE-001: type-level regression for the Evaluation Profile & Rule contract — no real rule
 * bodies exist yet (that's GE-002+), so this only proves the shapes compose as Product
 * Bible §4/§4a describe: a Profile is a named bundle of Rule ids (no `evaluate` of its
 * own); a Rule is a pure, synchronous function from EvaluationInput to EvaluationOutput.
 */
describe('Evaluation Profile & Rule Domain Contract (GE-001)', () => {
  it('composes a Profile from Rule ids and runs a Rule against an EvaluationInput', () => {
    const alwaysOnTrackRule: Rule = {
      id: 'always-on-track',
      name: 'Always On Track (test fixture)',
      description: 'Fixture rule for contract-shape testing only.',
      evaluate: (_input: EvaluationInput): EvaluationOutput => ({
        assessment: 'on-track',
        insights: [],
        warnings: [],
        recommendations: [],
        goalProgress: [
          { label: 'calories', consumed: 0, target: 2000, remaining: 2000, status: 'under' },
        ],
      }),
    };

    const profile: EvaluationProfile = {
      id: 'evidence-based-standard',
      name: 'Evidence-based Standard',
      origin: 'preset',
      ruleIds: [alwaysOnTrackRule.id],
      metadata: { motivation: 'Ich möchte mich gesünder ernähren.', maturity: 'candidate' },
    };

    const input: EvaluationInput = {
      foodCatalogReads: [],
      journalReadsForPeriod: [],
      profileSettings: {},
    };

    const output = alwaysOnTrackRule.evaluate(input);

    expect(profile.ruleIds).toContain(alwaysOnTrackRule.id);
    expect(profile.origin).toBe('preset');
    expect(output.goalProgress[0].status).toBe('under');
  });

  it('accepts every documented Origin value (Product Bible §4)', () => {
    const origins: EvaluationProfile['origin'][] = [
      'preset',
      'user',
      'professional',
      'community',
      'ai',
    ];

    for (const origin of origins) {
      const profile: EvaluationProfile = {
        id: `profile-${origin}`,
        name: origin,
        origin,
        ruleIds: [],
        metadata: {},
      };
      expect(profile.origin).toBe(origin);
    }
  });
});
