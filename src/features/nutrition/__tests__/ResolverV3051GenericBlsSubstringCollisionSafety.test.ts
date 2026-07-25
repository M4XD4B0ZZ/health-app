import {
  BLS_GENERIC_FOODS,
  searchBlsGenericFoods,
} from '../infrastructure/catalog/sources/blsGenericFoods';
import {
  hasBlsGenericSubstringOnlyIdentity,
  BlsLookupEngine,
} from '../infrastructure/catalog/sources/bls/BlsLookupEngine';
import { BLS_CANONICAL_SHORTCUTS } from '../infrastructure/catalog/sources/blsGenericFoods';
import { BlsStaticSource } from '../infrastructure/catalog/sources/BlsStaticSource';
import { SequentialFoodCatalogResolver } from '../application/services/SequentialFoodCatalogResolver';
import { DefaultConfidenceEngine } from '../domain/confidence/DefaultConfidenceEngine';
import { DEFAULT_CATALOG_CONFIG } from '../domain/models/FoodCatalogConfig';
import { NoopResolverRunLogger } from '../application/ports/ResolverRunLogger';
import { DeterministicFoodParser } from '../infrastructure/parsers/DeterministicFoodParser';
import { LogFoodFromRawInputUseCase } from '../application/usecases/LogFoodFromRawInputUseCase';
import { InMemoryFoodEntryRepository } from '../infrastructure/repositories/InMemoryFoodEntryRepository';
import { normalizeText } from '../application/utils/normalizeText';
import { REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS } from '../benchmark/representativeHybridV1/RepresentativeHybridV1Manifest';

/**
 * RESOLVER-V3-051: permanent regression coverage for the generic BLS substring-collision
 * false-confidence defect surfaced by RESOLVER-V3-050's residual-risk finding for
 * `RH-RES-VAGUE-DEV-004` ("Ein Snack"): the parsed generic query "snack" substring-matched the
 * far more specific BLS compound food "Kichererbsensnack gebacken" (X5A1030) and was accepted with
 * false confidence, despite `abstention_expected` ground truth.
 *
 * Root cause: `BlsLookupEngine`'s single-token Stage-4 token matching
 * (`calculateTokenScore`) awards partial credit (0.8) whenever the query is a substring of *either*
 * side (record token contains query, or query contains record token) — with no distinction between
 * "query is a compound whose component matches a generic record" (safe; e.g. "Bauchspeck" matching
 * its own record) and "query is a bare generic word fused inside a more specific German compound
 * noun" (unsafe; e.g. "snack" fused inside "Kichererbsensnack"). The same underlying risk also
 * exists one stage later via `findIncludesMatches`'s alias-substring fallback, so a stage-local fix
 * would not have closed the defect — see `reports/RESOLVER_V3_051_GENERIC_BLS_SUBSTRING_COLLISION_SAFETY.md`
 * for the full audit and rejected alternatives.
 *
 * Fix: a categorical, source-grounded, stage-agnostic policy —
 * `hasBlsGenericSubstringOnlyIdentity` — applied at the resolver's BLS generic-truth early-return
 * gate (`SequentialFoodCatalogResolver.ts`), independent of which BlsLookupEngine stage produced
 * the winning candidate. A candidate is disqualified from confident acceptance only when it has no
 * genuine exact/whole-alias identity for the query, the query is not even a whole-token match
 * against the candidate's own name, and the query is still a strict substring fragment of that
 * name. Retrieval/ranking are untouched — the candidate remains discoverable; only the *confident
 * accept* is blocked, converted to an honest `ambiguous` (matching the established
 * `BLS_GENERIC_PREPARATION_STATE_AMBIGUITY` precedent's shape).
 */
describe('RESOLVER-V3-051: generic BLS substring-collision safety', () => {
  describe('DeterministicFoodParser boundary', () => {
    it('"Ein Snack" parses to the actual production food name "snack"', () => {
      const parser = new DeterministicFoodParser();
      const result = parser.parse('Ein Snack');

      expect(result.name).toBe('snack');
      expect(result.quantityCount).toBe(1);
    });
  });

  describe('BlsLookupEngine / blsGenericFoods boundary (real compact runtime artifact)', () => {
    it('bare "snack" no longer surfaces X5A1030 ("Kichererbsensnack gebacken") as a confident single-candidate match via toCandidate exactness', () => {
      const results = searchBlsGenericFoods('snack');
      const snackRecord = results.find((r) => r.food.sourceId === 'X5A1030');

      // The candidate may still be discoverable (retrieval is untouched by this task);
      // it must simply never claim exact identity for the bare, generic word "snack".
      if (snackRecord) {
        expect(snackRecord.match.exact).toBe(false);
      }
    });

    it('X5A1030 ("Kichererbsensnack gebacken") exists in the real BLS population with the diagnosed macros', () => {
      const record = BLS_GENERIC_FOODS.find((r) => r.sourceId === 'X5A1030');
      expect(record).toBeDefined();
      expect(record?.displayName).toBe('Kichererbsensnack gebacken');
      expect(record?.macrosPer100g.kcal).toBe(231);
    });

    describe('hasBlsGenericSubstringOnlyIdentity: candidate provenance and match-type classification', () => {
      it('flags a generic word fused inside a more specific compound noun (the "snack" defect class)', () => {
        expect(
          hasBlsGenericSubstringOnlyIdentity('snack', {
            normalizedName: 'kichererbsensnack gebacken',
            exact: false,
          }),
        ).toBe(true);
      });

      it('does not flag a genuine exact/whole-alias identity match, regardless of textual containment', () => {
        expect(
          hasBlsGenericSubstringOnlyIdentity('quark', {
            normalizedName: 'quark',
            exact: true,
          }),
        ).toBe(false);
      });

      it('does not flag a whole-token match (every query token is a complete token of the candidate name)', () => {
        expect(
          hasBlsGenericSubstringOnlyIdentity('pommes frites', {
            normalizedName: 'pommes frites tiefgefroren',
            exact: false,
          }),
        ).toBe(false);
        expect(
          hasBlsGenericSubstringOnlyIdentity('bauchspeck', {
            normalizedName: 'bauchspeck roh',
            exact: false,
          }),
        ).toBe(false);
      });

      it('does not flag when query and candidate name are identical modulo whitespace collapsing', () => {
        expect(
          hasBlsGenericSubstringOnlyIdentity('apfelkuchen', {
            normalizedName: 'apfel kuchen',
            exact: false,
          }),
        ).toBe(false);
      });

      it('does not flag when the candidate name does not textually contain the query at all', () => {
        expect(
          hasBlsGenericSubstringOnlyIdentity('snack', {
            normalizedName: 'kartoffelchips paprika',
            exact: false,
          }),
        ).toBe(false);
      });

      it('flags the reverse compound-embedding direction too (query fused inside a longer single word)', () => {
        expect(
          hasBlsGenericSubstringOnlyIdentity('nuss', {
            normalizedName: 'erdnussbutter',
            exact: false,
          }),
        ).toBe(true);
      });
    });

    it('raw engine search: "snack" produces at most weak (non-exact) evidence for every candidate it returns', () => {
      const engine = new BlsLookupEngine(BLS_GENERIC_FOODS, BLS_CANONICAL_SHORTCUTS);
      const results = engine.search('snack');
      for (const result of results) {
        expect(result.matchKind).not.toBe('exact');
      }
    });
  });

  describe('resolver boundary (real SequentialFoodCatalogResolver + BlsStaticSource): bare "Snack" is no longer falsely accepted', () => {
    function buildResolver() {
      return new SequentialFoodCatalogResolver(
        [new BlsStaticSource()],
        new DefaultConfidenceEngine(),
        DEFAULT_CATALOG_CONFIG,
        undefined,
        new NoopResolverRunLogger(),
      );
    }

    it('bare "snack" (inputType generic) does not resolve to X5A1030 with a confident accept', async () => {
      const decision = await buildResolver().resolve({
        raw: 'Snack',
        normalized: normalizeText('Snack'),
        locale: 'de',
        inputType: 'generic',
      });

      const wonByColliding =
        decision.status === 'accepted' && decision.best?.food.sourceId === 'X5A1030';
      expect(wonByColliding).toBe(false);
    });

    it('bare "snack" resolves an honest non-accepted status (ambiguous, no_match/rejected, or another non-accepted state)', async () => {
      const decision = await buildResolver().resolve({
        raw: 'Snack',
        normalized: normalizeText('Snack'),
        locale: 'de',
        inputType: 'generic',
      });

      expect(decision.status).not.toBe('accepted');
    });

    it('when the resolver returns ambiguous for "snack" via the new check, `best` is cleared and the reason code is present', async () => {
      const decision = await buildResolver().resolve({
        raw: 'Snack',
        normalized: normalizeText('Snack'),
        locale: 'de',
        inputType: 'generic',
      });

      if (decision.reasonCodes.includes('BLS_GENERIC_SUBSTRING_COLLISION_RISK')) {
        expect(decision.status).toBe('ambiguous');
        expect(decision.best).toBeUndefined();
      }
    });
  });

  describe('production-call boundary (real DeterministicFoodParser -> resolver, LogFoodFromRawInputUseCase)', () => {
    function buildUseCase() {
      const resolver = new SequentialFoodCatalogResolver(
        [new BlsStaticSource()],
        new DefaultConfidenceEngine(),
        DEFAULT_CATALOG_CONFIG,
        undefined,
        new NoopResolverRunLogger(),
      );
      const mockFoodCatalog = {
        getById: async () => null,
        searchByName: async () => null,
      };
      return new LogFoodFromRawInputUseCase(
        new InMemoryFoodEntryRepository(),
        { now: () => new Date('2024-01-15T10:00:00Z'), todayISO: () => '2024-01-15' },
        {
          newId: (() => {
            let n = 0;
            return () => `id-${++n}`;
          })(),
        } as any,
        new DeterministicFoodParser(),
        mockFoodCatalog as any,
        undefined,
        undefined,
        undefined,
        resolver as any,
      );
    }

    it('"Ein Snack" never silently persists X5A1030 as a confidently-resolved food entry', async () => {
      const useCase = buildUseCase();

      let persisted: Awaited<ReturnType<typeof useCase.execute>> | undefined;
      let thrown: unknown;
      try {
        persisted = await useCase.execute({ rawText: 'Ein Snack', rawInput: 'Ein Snack' });
      } catch (error) {
        thrown = error;
      }

      if (persisted) {
        expect(persisted.foodCatalogRef?.sourceId).not.toBe('X5A1030');
      } else {
        expect(thrown).toBeDefined();
      }
    });
  });

  describe('Resolver V3 benchmark boundary: RH-RES-VAGUE-DEV-004 under the V3-050 production-faithful boundary', () => {
    it('the frozen corpus scenario for "Ein Snack" exists with abstention_expected ground truth', () => {
      const scenario = REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS.find(
        (s) => s.scenarioId === 'RH-RES-VAGUE-DEV-004',
      ) as { case: { rawInput: string; expectedBehavior: string } } | undefined;
      expect(scenario).toBeDefined();
      expect(scenario?.case.rawInput).toBe('Ein Snack');
      expect(scenario?.case.expectedBehavior).toBe('abstention_expected');
    });

    it('the production-faithful call path (DeterministicFoodParser -> resolver) no longer falsely accepts X5A1030 for this scenario', async () => {
      const parser = new DeterministicFoodParser();
      const parsed = parser.parse('Ein Snack');
      const resolver = new SequentialFoodCatalogResolver(
        [new BlsStaticSource()],
        new DefaultConfidenceEngine(),
        DEFAULT_CATALOG_CONFIG,
        undefined,
        new NoopResolverRunLogger(),
      );

      const decision = await resolver.resolve({
        raw: 'Ein Snack',
        normalized: normalizeText(parsed.name),
        locale: 'de',
        inputType: 'generic',
      });

      const wonByColliding =
        decision.status === 'accepted' && decision.best?.food.sourceId === 'X5A1030';
      expect(wonByColliding).toBe(false);
    });
  });

  describe('positive controls: qualified compound-food queries and V3-043/V3-049 outcomes remain resolvable', () => {
    function buildResolver() {
      return new SequentialFoodCatalogResolver(
        [new BlsStaticSource()],
        new DefaultConfidenceEngine(),
        DEFAULT_CATALOG_CONFIG,
        undefined,
        new NoopResolverRunLogger(),
      );
    }

    const controls: { label: string; raw: string; expectedSourceId: string }[] = [
      { label: 'Quark', raw: 'Quark', expectedSourceId: 'M713100' },
      { label: 'Magerquark', raw: 'Magerquark', expectedSourceId: 'M713100' },
      { label: 'Rührei', raw: 'Rührei', expectedSourceId: 'Y720143' },
      {
        label: 'Brötchen Blätterteig (RESOLVER-V3-043 Phase A)',
        raw: 'Brötchen Blätterteig',
        expectedSourceId: 'D771900',
      },
      { label: 'Eier', raw: 'Eier', expectedSourceId: 'Y720100' },
      {
        label: 'Hafer Flocken, gekocht (RESOLVER-V3-049 qualified)',
        raw: 'Hafer Flocken, gekocht',
        expectedSourceId: 'C133032',
      },
      {
        label: 'Pommes frites tiefgefroren, gebacken (RESOLVER-V3-049 qualified)',
        raw: 'Pommes frites tiefgefroren, gebacken',
        expectedSourceId: 'K130262',
      },
      {
        label: 'Kichererbsensnack gebacken (qualified target, exact identity)',
        raw: 'Kichererbsensnack gebacken',
        expectedSourceId: 'X5A1030',
      },
    ];

    for (const { label, raw, expectedSourceId } of controls) {
      it(`${label}: still resolves accepted to ${expectedSourceId}`, async () => {
        const decision = await buildResolver().resolve({
          raw,
          normalized: normalizeText(raw),
          locale: 'de',
          inputType: 'generic',
        });

        expect(decision.status).toBe('accepted');
        expect(decision.best?.food.sourceId).toBe(expectedSourceId);
      });
    }

    // RESOLVER-V2-010's qualified Speck sub-terms have a pre-existing, unrelated
    // MULTIPLE_CLOSE_MATCHES ambiguous status (a real second-place candidate within the ordinary
    // score-delta threshold, e.g. "Rückenspeck" vs. the generic "Speck" record) with `best` still
    // correctly populated -- exactly the same pre-existing shape asserted by
    // RESOLVER-V3-049's own equivalent test (`decision.best?.food.sourceId`, not `decision.status`).
    // This task's new `hasBlsGenericSubstringOnlyIdentity` check never engages here (verified: it
    // never clears `best` or adds `BLS_GENERIC_SUBSTRING_COLLISION_RISK` for any of these three).
    const speckSubTerms: { label: string; raw: string; expectedSourceId: string }[] = [
      { label: 'Bauchspeck (RESOLVER-V2-010)', raw: 'Bauchspeck', expectedSourceId: 'W411300' },
      {
        label: 'Schinkenspeck (RESOLVER-V2-010)',
        raw: 'Schinkenspeck',
        expectedSourceId: 'U685142',
      },
      { label: 'Rückenspeck (RESOLVER-V2-010)', raw: 'Rückenspeck', expectedSourceId: 'U605000' },
    ];
    for (const { label, raw, expectedSourceId } of speckSubTerms) {
      it(`${label}: remains deterministic (best unaffected by RESOLVER-V3-051)`, async () => {
        const decision = await buildResolver().resolve({
          raw,
          normalized: normalizeText(raw),
          locale: 'de',
          inputType: 'generic',
        });

        expect(decision.best?.food.sourceId).toBe(expectedSourceId);
        expect(decision.reasonCodes).not.toContain('BLS_GENERIC_SUBSTRING_COLLISION_RISK');
      });
    }

    it('D771900 still never wins the bare "Brötchen" query (RESOLVER-V3-043 Phase A unaffected)', async () => {
      const decision = await buildResolver().resolve({
        raw: 'Brötchen',
        normalized: 'broetchen',
        locale: 'de',
        inputType: 'ambiguous',
      });

      expect(decision.candidates.some((c) => c.food.sourceId === 'D771900')).toBe(false);
      if (decision.status === 'accepted') {
        expect(decision.best?.food.sourceId).not.toBe('D771900');
      }
    });

    it('Haferflocken/Pommes preparation-state ambiguity (RESOLVER-V3-049) remains ambiguous', async () => {
      const decision = await buildResolver().resolve({
        raw: 'Haferflocken',
        normalized: 'haferflocken',
        locale: 'de',
        inputType: 'generic',
      });

      expect(decision.status).toBe('ambiguous');
      expect(decision.reasonCodes).toContain('BLS_GENERIC_PREPARATION_STATE_AMBIGUITY');
    });
  });
});
