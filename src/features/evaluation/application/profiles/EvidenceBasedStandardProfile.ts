import { EvaluationProfile } from '../../domain/models';
import { CalorieMacroCorridorRule } from '../rules/CalorieMacroCorridorRule';

/**
 * GE-002 / Product Bible §5 "Evidence-based Standard" — the Default-Profile: neutral
 * assessment against recognized reference values, no aggressive calorie restriction.
 * Structurally, this is the existing `features/goals` (`MetabolismProfile` ->
 * `EffectiveGoals`) system, now expressed as a GE-001 `EvaluationProfile`.
 */
export const EvidenceBasedStandardProfile: EvaluationProfile = {
  id: 'evidence-based-standard',
  name: 'Evidence-based Standard',
  origin: 'preset',
  ruleIds: [CalorieMacroCorridorRule.id],
  metadata: {
    motivation: 'Ich möchte mich gesünder ernähren.',
    maturity: 'mvp',
  },
};
