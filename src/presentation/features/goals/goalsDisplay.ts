import { EvaluationProfileOrigin } from '../../../features/evaluation';

/**
 * GE-008 / Product Bible §4b: "Evaluation Profile", "Preset", "Origin" are internal
 * architecture language only and must never appear literally in the product surface —
 * users choose a "Ziel", not a "Profil". This maps each internal Origin to its §4b
 * product-surface vocabulary. Purely display formatting, no evaluation logic.
 */
const ORIGIN_LABELS: Record<EvaluationProfileOrigin, string> = {
  preset: 'Vorgeschlagenes Ziel',
  user: 'Eigenes Ziel',
  professional: 'Ärztlich empfohlenes Ziel',
  community: 'Ziel aus der Community',
  ai: 'KI-vorgeschlagenes Ziel',
};

export function originLabel(origin: EvaluationProfileOrigin): string {
  return ORIGIN_LABELS[origin] ?? 'Ziel';
}
