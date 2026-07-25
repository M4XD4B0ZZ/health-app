import { searchBlsGenericFoods } from '../infrastructure/catalog/sources/blsGenericFoods';
import { BlsStaticSource } from '../infrastructure/catalog/sources/BlsStaticSource';
import { SequentialFoodCatalogResolver } from '../application/services/SequentialFoodCatalogResolver';
import { DefaultConfidenceEngine } from '../domain/confidence/DefaultConfidenceEngine';
import { DEFAULT_CATALOG_CONFIG } from '../domain/models/FoodCatalogConfig';

/**
 * RESOLVER-V2-009 — plain-generic BLS food reachability.
 *
 * Proven in RESOLVER-V2-008: "Himbeeren"/"Haferflocken" selected processed/compound BLS records
 * (a dessert / a milk soup) because the plain generic food was unreachable — its alias is a
 * singular/space form the compact query is not a substring of, and a weak `includes` match
 * short-circuited before token matching. This locks the fixed behavior and guards the untouched
 * cases (Speck ambiguity, Magerquark, compound guard).
 */
describe('RESOLVER-V2-009 plain-generic BLS reachability', () => {
  const bestFor = async (normalized: string) => {
    const resolver = new SequentialFoodCatalogResolver(
      [new BlsStaticSource()],
      new DefaultConfidenceEngine(),
      DEFAULT_CATALOG_CONFIG,
    );
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const result = await resolver.resolve({
      raw: normalized,
      normalized,
      locale: 'de',
      inputType: 'generic',
    });
    spy.mockRestore();
    return result.best;
  };

  it('Himbeeren resolves to the plain raw raspberry (F302100, 43 kcal), not a dessert', () => {
    const top = searchBlsGenericFoods('himbeeren')[0];
    expect(top.food.sourceId).toBe('F302100');
    expect(top.food.name).toBe('Himbeere roh');
    expect(top.food.macrosPer100g.kcal).toBe(43);
  });

  it('Himbeeren is selected end-to-end as the plain raw raspberry (not 275 kcal dessert)', async () => {
    // RESOLVER-V3-049 note: Himbeeren's top candidates arise from `BlsLookupEngine`'s
    // single-long-token ranked-token-override branch (RESOLVER-V2-009's own deliberate winner-
    // picking system), which RESOLVER-V3-049's new preparation-state-ambiguity check intentionally
    // does not re-litigate -- see `SequentialFoodCatalogResolver.ts`'s
    // `eligibleForPreparationStateCheck` scoping note. This test's original behavior is therefore
    // unaffected by RESOLVER-V3-049.
    const best = await bestFor('himbeeren');
    expect(best?.food.sourceId).toBe('F302100');
    expect(best?.food.macrosPer100g.kcal).toBe(43);
  });

  it('singular Himbeere remains the plain raw raspberry', () => {
    const top = searchBlsGenericFoods('himbeere')[0];
    expect(top.food.sourceId).toBe('F302100');
    expect(top.food.macrosPer100g.kcal).toBe(43);
  });

  it('Haferflocken resolves to the plain oat flakes (C133000, 348 kcal), not a milk soup', () => {
    const top = searchBlsGenericFoods('haferflocken')[0];
    expect(top.food.sourceId).toBe('C133000');
    expect(top.food.name).toBe('Hafer Flocken');
    expect(top.food.macrosPer100g.kcal).toBe(348);
  });

  it('RESOLVER-V3-049: Haferflocken now resolves an honest ambiguous (raw 348 / gekocht 66 kcal) instead of silently defaulting to the raw candidate', async () => {
    // RESOLVER-V3-049's owned case `RH-RES-PREPARATION-DEV-002`. This test previously asserted
    // `best?.food.sourceId === 'C133000'` -- exactly the false-confidence defect this task fixes:
    // raw (348 kcal) and cooked (66 kcal) are both real, exact-tied BLS candidates (Stage 1 --
    // *not* the ranked-token-override branch Himbeeren above uses) for the bare, unqualified
    // query, a >5x divergence, and the resolver must not silently pick one. See
    // reports/RESOLVER_V3_049_BLS_GENERIC_FAST_PATH_AMBIGUITY_POLICY.md.
    const best = await bestFor('haferflocken');
    expect(best).toBeUndefined();
  });

  it('whitespace-insensitive: the spaced "hafer flocken" also resolves to the plain flakes', () => {
    const top = searchBlsGenericFoods('hafer flocken')[0];
    expect(top.food.sourceId).toBe('C133000');
    expect(top.food.macrosPer100g.kcal).toBe(348);
  });

  it('a weak includes candidate no longer suppresses the stronger plain-food match', () => {
    const ids = searchBlsGenericFoods('himbeeren').map((c) => c.food.sourceId);
    // The dessert D3A4000 (275) that previously won must not be the top result anymore.
    expect(ids[0]).toBe('F302100');
    expect(ids[0]).not.toBe('D3A4000');
  });

  it('produces no duplicate candidates and is deterministic across runs', () => {
    const run1 = searchBlsGenericFoods('himbeeren').map((c) => c.food.sourceId);
    const run2 = searchBlsGenericFoods('himbeeren').map((c) => c.food.sourceId);
    expect(run1).toEqual(run2);
    expect(new Set(run1).size).toBe(run1.length);
  });

  it('Magerquark is unchanged: exactly one exact match M713100 (66 kcal)', () => {
    const results = searchBlsGenericFoods('magerquark');
    expect(results).toHaveLength(1);
    expect(results[0].food.sourceId).toBe('M713100');
    expect(results[0].food.macrosPer100g.kcal).toBe(66);
    expect(results[0].match.similarity).toBeGreaterThan(0.8);
  });

  it('Speck is unchanged: same candidate set/order and end-to-end selection (W412000, 746)', async () => {
    const ids = searchBlsGenericFoods('speck').map((c) => c.food.sourceId);
    expect(ids).toEqual(['U605700', 'W412000', 'W411000']);
    const best = await bestFor('speck');
    expect(best?.food.sourceId).toBe('W412000');
    expect(best?.food.macrosPer100g.kcal).toBe(746);
  });

  it('the unknown-compound guard is preserved: "quarktoast" yields no candidates', () => {
    expect(searchBlsGenericFoods('quarktoast')).toEqual([]);
  });
});
