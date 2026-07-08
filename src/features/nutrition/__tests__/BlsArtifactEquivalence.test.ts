import { adaptBlsCompactRuntimeRecords } from '../infrastructure/catalog/sources/bls/BlsCompactRuntimeAdapter';
import { BlsCompactRuntimeArtifact } from '../infrastructure/catalog/sources/bls/BlsCompactRuntimeTypes';
import blsCompactRuntimeArtifactJson from '../infrastructure/catalog/sources/bls/generated/bls-runtime-compact.v1.json';

/**
 * P1-006C3E2A — read-only equivalence tests.
 *
 * Verifies that the real generated compact BLS artifact, once run through
 * the adapter, preserves the known anchor records the current mini-source
 * runtime relies on. This does not touch blsGenericFoods.ts, BlsStaticSource.ts,
 * or BlsLookupEngine.ts, and does not change resolver behavior — it only
 * proves the artifact/adapter are ready for a future runtime switch (C3E2B).
 */
describe('BLS artifact equivalence (pre-migration, read-only)', () => {
  const artifact = blsCompactRuntimeArtifactJson as unknown as BlsCompactRuntimeArtifact;
  const adaptedRecords = adaptBlsCompactRuntimeRecords(artifact);

  const findBySourceId = (sourceId: string) =>
    adaptedRecords.find((record) => record.sourceId === sourceId);

  it('adapts M713100 (Magerquark) equivalently to the mini-source record', () => {
    const record = findBySourceId('M713100');

    expect(record).toBeDefined();
    expect(record?.displayName).toBe('Speisequark Magerstufe, Magerquark < 10 % Fett i. Tr.');
    expect(record?.macrosPer100g).toEqual({ kcal: 66, protein: 11.85, fat: 0.18, carbs: 3.68 });
    expect(record?.aliases).toEqual(
      expect.arrayContaining(['magerquark', 'quark', 'speisequark', 'magerstufe']),
    );
  });

  it('adapts B314000 (Toast) equivalently to the mini-source record', () => {
    const record = findBySourceId('B314000');

    expect(record).toBeDefined();
    expect(record?.displayName).toBe('Weizentoastbrot/Buttertoastbrot');
    expect(record?.macrosPer100g).toEqual({ kcal: 261, protein: 8.29, fat: 3.59, carbs: 46.8 });
    expect(record?.aliases).toEqual(
      expect.arrayContaining(['toast', 'toastbrot', 'weizentoastbrot', 'buttertoast']),
    );
  });

  it('adapts Y720143 (Rührei) with matching macros and current (phrase-only) aliases', () => {
    const record = findBySourceId('Y720143');

    expect(record).toBeDefined();
    expect(record?.displayName).toBe('Rührei gebraten');
    expect(record?.macrosPer100g).toEqual({ kcal: 203, protein: 12.88, fat: 16.61, carbs: 0.39 });

    // Documents current adapter behavior only: buildBlsRuntimeAliases derives
    // aliases by splitting the display name on slash/comma/semicolon, and
    // "Rührei gebraten" has no such delimiter, so today's adapted aliases are
    // phrase-level only. A dedicated bare-word compatibility alias for
    // "ruehrei"/"rührei" (matching the mini-source's exact-match behavior) is
    // planned for C3E2B, not this task.
    expect(record?.aliases).toEqual(expect.arrayContaining(['ruehrei gebraten']));
  });

  it('documents E111100 (Hühnerei roh) as the closest artifact match to the legacy Y720100 record, without resolving the discrepancy', () => {
    const record = findBySourceId('E111100');

    expect(record).toBeDefined();
    expect(record?.displayName).toBe('Hühnerei roh');
    expect(record?.macrosPer100g).toEqual({ kcal: 135, protein: 13.175, fat: 9, carbs: 0.34 });

    // E111100's macros differ materially from the mini-source's Y720100
    // ("Huehnerei ganz roh": kcal 137 / protein 11.9 / carbs 1.5 / fat 9.3).
    // Whether E111100 should become the canonical replacement for Y720100 is
    // a nutrition-data decision left for a dedicated follow-up (see the
    // P1-006C3E2 plan) — this test only pins today's artifact values.
  });

  it('confirms the legacy mini-source sourceId Y720100 is absent from the generated artifact', () => {
    // Documents current artifact contents only. This is the known,
    // intentionally unresolved gap that blocks a direct 1:1 runtime switch
    // for plain "ei" — see the P1-006C3E2 plan for the recommended overlay
    // approach.
    expect(findBySourceId('Y720100')).toBeUndefined();
  });
});
