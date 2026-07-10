import { EvaluationProfile } from '../../domain/models';
import { ProteinPreservingDeficitRule } from '../rules/ProteinPreservingDeficitRule';

/**
 * GE-004 / Product Bible §5 "Weight Loss": Kaloriendefizit, Proteinerhalt zum
 * Muskelschutz, Sättigungsaspekte. Second concrete Preset, proving the same
 * Journal data reinterprets differently under a different active profile
 * (§2a Variante B) rather than the contract only fitting one shape.
 */
export const WeightLossProfile: EvaluationProfile = {
  id: 'weight-loss',
  name: 'Weight Loss',
  origin: 'preset',
  ruleIds: [ProteinPreservingDeficitRule.id],
  metadata: {
    motivation: 'Ich möchte Gewicht verlieren.',
    maturity: 'mvp',
  },
};
