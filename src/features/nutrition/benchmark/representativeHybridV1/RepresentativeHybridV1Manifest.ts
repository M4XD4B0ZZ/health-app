import { createHash } from 'node:crypto';
import {
  REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION,
  REPRESENTATIVE_HYBRID_V1_REGISTRY_VERSION,
  type RepresentativeHybridV1RegistryManifest,
  type RepresentativeHybridV1Scenario,
} from './RepresentativeHybridV1Types';
import { REPRESENTATIVE_HYBRID_V1_SIMPLE_SCENARIOS } from './RepresentativeHybridV1SimpleCorpus';
import { REPRESENTATIVE_HYBRID_V1_HOUSEHOLD_SCENARIOS } from './RepresentativeHybridV1HouseholdCorpus';
import { REPRESENTATIVE_HYBRID_V1_DACH_SCENARIOS } from './RepresentativeHybridV1DachCorpus';
import { REPRESENTATIVE_HYBRID_V1_BRANDED_SCENARIOS } from './RepresentativeHybridV1BrandedCorpus';
import { REPRESENTATIVE_HYBRID_V1_COMPOSED_SCENARIOS } from './RepresentativeHybridV1ComposedCorpus';
import { REPRESENTATIVE_HYBRID_V1_HOMEMADE_SCENARIOS } from './RepresentativeHybridV1HomemadeCorpus';
import { REPRESENTATIVE_HYBRID_V1_RESTAURANT_SCENARIOS } from './RepresentativeHybridV1RestaurantCorpus';
import { REPRESENTATIVE_HYBRID_V1_VAGUE_SCENARIOS } from './RepresentativeHybridV1VagueCorpus';
import { REPRESENTATIVE_HYBRID_V1_PREPARATION_SCENARIOS } from './RepresentativeHybridV1PreparationCorpus';
import { REPRESENTATIVE_HYBRID_V1_NEGATION_MODIFIER_SCENARIOS } from './RepresentativeHybridV1NegationModifierCorpus';
import { REPRESENTATIVE_HYBRID_V1_UNRELIABLE_SCENARIOS } from './RepresentativeHybridV1UnreliableCorpus';
import { REPRESENTATIVE_HYBRID_V1_REPEAT_OVERLAY_SCENARIOS } from './RepresentativeHybridV1RepeatOverlayCorpus';
import {
  REPRESENTATIVE_HYBRID_V1_ECONOMICS_SCENARIOS,
  REPRESENTATIVE_HYBRID_V1_GLOBAL_CANDIDATE_SCENARIOS,
  REPRESENTATIVE_HYBRID_V1_PERSONAL_MEMORY_SCENARIOS,
  REPRESENTATIVE_HYBRID_V1_PRIVACY_SCENARIOS,
} from './RepresentativeHybridV1GovernanceCorpus';

/**
 * The complete, frozen RESOLVER-V3-038 corpus (requirement 26 holdout freeze protocol). Combines
 * every scenario domain. Sorted deterministically by `scenarioId` so fixture declaration order never
 * affects the canonical corpus hash.
 */
export const REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS: readonly RepresentativeHybridV1Scenario[] =
  [
    ...REPRESENTATIVE_HYBRID_V1_SIMPLE_SCENARIOS,
    ...REPRESENTATIVE_HYBRID_V1_HOUSEHOLD_SCENARIOS,
    ...REPRESENTATIVE_HYBRID_V1_DACH_SCENARIOS,
    ...REPRESENTATIVE_HYBRID_V1_BRANDED_SCENARIOS,
    ...REPRESENTATIVE_HYBRID_V1_COMPOSED_SCENARIOS,
    ...REPRESENTATIVE_HYBRID_V1_HOMEMADE_SCENARIOS,
    ...REPRESENTATIVE_HYBRID_V1_RESTAURANT_SCENARIOS,
    ...REPRESENTATIVE_HYBRID_V1_VAGUE_SCENARIOS,
    ...REPRESENTATIVE_HYBRID_V1_PREPARATION_SCENARIOS,
    ...REPRESENTATIVE_HYBRID_V1_NEGATION_MODIFIER_SCENARIOS,
    ...REPRESENTATIVE_HYBRID_V1_UNRELIABLE_SCENARIOS,
    ...REPRESENTATIVE_HYBRID_V1_REPEAT_OVERLAY_SCENARIOS,
  ];

export const REPRESENTATIVE_HYBRID_V1_CORPUS: readonly RepresentativeHybridV1Scenario[] = [
  ...REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS,
  ...REPRESENTATIVE_HYBRID_V1_PERSONAL_MEMORY_SCENARIOS,
  ...REPRESENTATIVE_HYBRID_V1_GLOBAL_CANDIDATE_SCENARIOS,
  ...REPRESENTATIVE_HYBRID_V1_PRIVACY_SCENARIOS,
  ...REPRESENTATIVE_HYBRID_V1_ECONOMICS_SCENARIOS,
]
  .slice()
  .sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));

export const REPRESENTATIVE_HYBRID_V1_REGISTRY_MANIFEST: RepresentativeHybridV1RegistryManifest = {
  registryVersion: REPRESENTATIVE_HYBRID_V1_REGISTRY_VERSION,
  entries: REPRESENTATIVE_HYBRID_V1_CORPUS.map((scenario) => ({
    scenarioId: scenario.scenarioId,
    partition: scenario.partition,
  })),
};

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

function canonicalStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

/** Deterministic, order-independent content hash: sorts scenarios by ID first, then hashes their
 * canonically key-ordered JSON serialization. */
export function computeRepresentativeHybridV1CorpusHash(
  scenarios: readonly RepresentativeHybridV1Scenario[] = REPRESENTATIVE_HYBRID_V1_CORPUS,
): string {
  const sorted = [...scenarios].sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));
  const canonical = sorted.map((scenario) => canonicalStringify(scenario));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export const REPRESENTATIVE_HYBRID_V1_CORPUS_HASH = computeRepresentativeHybridV1CorpusHash();

export { REPRESENTATIVE_HYBRID_V1_CORPUS_VERSION };
