import { EvaluationInput, EvaluationOutput, Rule } from '../../domain/models';
import { EvaluationProfileRegistry } from '../ports/EvaluationProfileRegistry';
import { mergeRuleResults } from '../mergeRuleResults';

export class UnknownEvaluationProfileError extends Error {
  constructor(profileId: string) {
    super(`Unknown active EvaluationProfile id: ${profileId}`);
    this.name = 'UnknownEvaluationProfileError';
  }
}

export class UnknownRuleError extends Error {
  constructor(ruleId: string, profileId: string) {
    super(`Unknown Rule id: ${ruleId} (referenced by profile ${profileId})`);
    this.name = 'UnknownRuleError';
  }
}

/**
 * GE-003: resolves the active EvaluationProfile (via the registry), runs each of its Rules
 * against the same `EvaluationInput`, and merges the results — the first end-to-end
 * "swap the interpretation without touching Journal/Food Catalog" code path. Not wired
 * into any screen yet.
 */
export class GetActiveEvaluationOutputUseCase {
  constructor(
    private readonly registry: EvaluationProfileRegistry,
    private readonly knownRules: Rule[],
  ) {}

  async execute(input: EvaluationInput): Promise<EvaluationOutput> {
    const activeProfileId = await this.registry.getActiveProfileId();
    const profile = this.registry.list().find((p) => p.id === activeProfileId);
    if (!profile) {
      throw new UnknownEvaluationProfileError(activeProfileId);
    }

    const results = profile.ruleIds.map((ruleId) => {
      const rule = this.knownRules.find((r) => r.id === ruleId);
      if (!rule) {
        throw new UnknownRuleError(ruleId, profile.id);
      }
      return rule.evaluate(input);
    });

    return mergeRuleResults(results);
  }
}
