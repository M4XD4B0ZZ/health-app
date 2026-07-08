import { FoodCandidate } from '../../../domain/catalog/FoodCatalogSource';
import { BlsFoodRecord, BlsLookupEngine } from './bls/BlsLookupEngine';
import { adaptBlsCompactRuntimeRecords } from './bls/BlsCompactRuntimeAdapter';
import { BlsCompactRuntimeArtifact } from './bls/BlsCompactRuntimeTypes';
import blsCompactRuntimeArtifactJson from './bls/generated/bls-runtime-compact.v1.json';

/**
 * Legacy compatibility overlay (P1-006C3E2B1).
 *
 * The generated compact BLS artifact (bls-runtime-compact.v1.json) does not
 * contain sourceId Y720100 ("Huehnerei ganz roh"). Its closest match,
 * E111100 ("Hühnerei roh"), has materially different macros (kcal 135 vs 137,
 * protein 13.175 vs 11.9, carbs 0.34 vs 1.5, fat 9 vs 9.3) — see
 * BlsArtifactEquivalence.test.ts. Whether E111100 should become the canonical
 * replacement for Y720100 is an unresolved nutrition-data decision left for a
 * dedicated follow-up, so this overlay copies the legacy Y720100 record
 * unchanged to preserve current runtime behavior instead of silently
 * substituting E111100.
 */
const LEGACY_Y720100_OVERLAY: BlsFoodRecord = {
  id: 'bls-ei-roh',
  sourceId: 'Y720100',
  displayName: 'Huehnerei ganz roh',
  normalizedName: 'ei',
  aliases: ['ei', 'eier', 'huehnerei', 'hühnerei'],
  tokens: ['huhn', 'hühn', 'ei', 'eier', 'roh'],
  macrosPer100g: { kcal: 137, protein: 11.9, carbs: 1.5, fat: 9.3 },
};

const artifactRuntimeRecords = adaptBlsCompactRuntimeRecords(
  blsCompactRuntimeArtifactJson as unknown as BlsCompactRuntimeArtifact,
);

export const BLS_GENERIC_FOODS: readonly BlsFoodRecord[] = [
  ...artifactRuntimeRecords,
  LEGACY_Y720100_OVERLAY,
];

export const BLS_CANONICAL_SHORTCUTS: Readonly<Record<string, BlsFoodRecord>> = {
  buttertoast: {
    id: 'bls-shortcut-buttertoast',
    sourceId: 'shortcut:buttertoast-default',
    displayName: 'Buttertoast (Default-Shortcut aus BLS-Toast + Butter-Annahme)',
    normalizedName: 'buttertoast',
    aliases: ['buttertoast'],
    tokens: ['butter', 'toast'],
    // Transparent default assumption: 85 g BLS toastbrot + 15 g butter per 100 g.
    macrosPer100g: { kcal: 334, protein: 7.23, carbs: 39.87, fat: 15.38 },
  },
};

let blsLookupEngineSingleton: BlsLookupEngine | null = null;

function getBlsLookupEngine(): BlsLookupEngine {
  if (!blsLookupEngineSingleton) {
    blsLookupEngineSingleton = new BlsLookupEngine(BLS_GENERIC_FOODS, BLS_CANONICAL_SHORTCUTS);
  }
  return blsLookupEngineSingleton;
}

export function getBlsShortcutCandidate(normalizedQuery: string): FoodCandidate | null {
  const engine = getBlsLookupEngine();
  const result = engine.lookupShortcut(normalizedQuery);
  return result ? engine.toCandidate(result) : null;
}

export function searchBlsGenericFoods(normalizedQuery: string): FoodCandidate[] {
  const engine = getBlsLookupEngine();
  return engine.search(normalizedQuery).map((result) => engine.toCandidate(result));
}
