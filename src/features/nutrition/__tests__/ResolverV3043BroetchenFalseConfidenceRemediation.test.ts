import {
  adaptBlsCompactRuntimeRecord,
  getIncompatibleGenericQueries,
} from '../infrastructure/catalog/sources/bls/BlsCompactRuntimeAdapter';
import { BlsCompactRuntimeRecord } from '../infrastructure/catalog/sources/bls/BlsCompactRuntimeTypes';
import { BlsStaticSource } from '../infrastructure/catalog/sources/BlsStaticSource';
import {
  BLS_GENERIC_FOODS,
  searchBlsGenericFoods,
} from '../infrastructure/catalog/sources/blsGenericFoods';
import { SequentialFoodCatalogResolver } from '../application/services/SequentialFoodCatalogResolver';
import { DefaultConfidenceEngine } from '../domain/confidence/DefaultConfidenceEngine';
import { DEFAULT_CATALOG_CONFIG } from '../domain/models/FoodCatalogConfig';
import { NoopResolverRunLogger } from '../application/ports/ResolverRunLogger';
import { DeterministicFoodParser } from '../infrastructure/parsers/DeterministicFoodParser';
import { LogFoodFromRawInputUseCase } from '../application/usecases/LogFoodFromRawInputUseCase';
import { InMemoryFoodEntryRepository } from '../infrastructure/repositories/InMemoryFoodEntryRepository';

/**
 * RESOLVER-V3-043: permanent regression coverage for the `D771900` ("Brötchen (Blätterteig)")
 * false-confidence defect (historical `RV3-0011`, benchmark case `RH-RES-DACH-DEV-006`).
 *
 * Root cause: `normalizeBlsRuntimeText()` strips *all* parenthetical content, so D771900's own
 * display name reduces to the bare, everyday word "Brötchen" -- a real bread roll's word, not
 * this puff-pastry roll's. `BlsLookupEngine.findExactMatches()` then returns immediately on any
 * exact-alias hit, pre-empting the dozens of legitimate "-brötchen" compound candidates before
 * they are ever scored. Removing only the generated exact alias is not sufficient on its own
 * (the record's own tokens and its "broetchen blaetterteig" alias still contain "broetchen" as a
 * component/substring, reachable via includes/token matching) -- see
 * `reports/RESOLVER_V3_043_UNSAFE_FAST_PATH_FALSE_CONFIDENCE_DIAGNOSIS.md` for the full trace.
 *
 * Fix: `INCOMPATIBLE_GENERIC_QUERIES_BY_SOURCE_ID` (`BlsCompactRuntimeAdapter.ts`) is a
 * source-ID-scoped negative-compatibility contract, the mirror image of the existing
 * `COMPATIBILITY_ALIASES_BY_SOURCE_ID`. It is threaded onto the adapted `BlsFoodRecord` as
 * `incompatibleGenericQueries` and consulted by `BlsLookupEngine` at every matching stage (exact,
 * includes, token, ranked-token) -- so D771900 can never win the bare query `broetchen` through
 * any path, while remaining fully reachable for the qualified query it actually names.
 */
describe('RESOLVER-V3-043: D771900 Brötchen false-confidence remediation', () => {
  describe('adapter boundary', () => {
    const record: BlsCompactRuntimeRecord = {
      id: 'bls:D771900',
      sourceId: 'D771900',
      displayName: 'Brötchen (Blätterteig)',
      macrosPer100g: { kcal: 425, protein: 4.18, fat: 32.19, carbs: 28.65 },
      nutrientsPer100g: {
        energyKj: 1778,
        waterG: 30,
        fiberG: 2.5,
        sugarG: 2,
        starchG: 20,
        alcoholG: 0,
        saltG: 1.2,
        sodiumMg: 480,
        saturatedFatG: 14,
        monounsaturatedFatG: 10,
        polyunsaturatedFatG: 6,
        omega3G: 0.1,
        omega6G: 3,
        cholesterolMg: 0,
      },
    };

    it('still generates the bare "broetchen" normalizedName/alias/token (generation itself is unchanged -- the parenthetical-stripping root cause)', () => {
      const adapted = adaptBlsCompactRuntimeRecord(record);

      // normalizeBlsRuntimeText strips the entire "(Blätterteig)" parenthetical -- this is the
      // root cause: the record's own display name reduces to the bare, everyday word.
      expect(adapted.normalizedName).toBe('broetchen');
      expect(adapted.aliases).toContain('broetchen');
      // The qualified form survives too (splitAliasCandidates keeps parenthetical *content*,
      // only stripping the parenthesis characters) -- this is what the qualified query matches.
      expect(adapted.aliases).toContain('broetchen blaetterteig');
      expect(adapted.tokens).toContain('broetchen');
    });

    it('marks D771900 as unable to win the bare "broetchen" generic query', () => {
      const adapted = adaptBlsCompactRuntimeRecord(record);

      expect(adapted.incompatibleGenericQueries).toEqual(['broetchen']);
      expect(getIncompatibleGenericQueries('D771900')).toEqual(['broetchen']);
    });

    it('does not mark unrelated records as incompatible with anything', () => {
      const adapted = adaptBlsCompactRuntimeRecord({ ...record, sourceId: 'D4A1000' });

      expect(adapted.incompatibleGenericQueries).toEqual([]);
      expect(getIncompatibleGenericQueries('D4A1000')).toEqual([]);
    });
  });

  describe('BLS lookup boundary (real compact runtime artifact)', () => {
    it('never returns D771900 for the bare query "broetchen"', () => {
      const results = searchBlsGenericFoods('broetchen');

      expect(results.some((r) => r.food.sourceId === 'D771900')).toBe(false);
    });

    it('still returns D771900 as an exact match for the qualified query "broetchen blaetterteig"', () => {
      const results = searchBlsGenericFoods('broetchen blaetterteig');

      expect(results).toHaveLength(1);
      expect(results[0].food.sourceId).toBe('D771900');
      expect(results[0].match.exact).toBe(true);
      expect(results[0].match.similarity).toBe(1);
    });

    it('has a conventional bread-roll record (B511000, Weizenbrötchen) present in the real artifact', () => {
      const weizenbroetchen = BLS_GENERIC_FOODS.find((r) => r.sourceId === 'B511000');

      expect(weizenbroetchen).toBeDefined();
      expect(weizenbroetchen?.displayName).toBe('Weizenbrötchen');
      expect(weizenbroetchen?.macrosPer100g.kcal).toBe(280);
    });
  });

  describe('resolver boundary (real SequentialFoodCatalogResolver + BlsStaticSource)', () => {
    function buildResolver() {
      return new SequentialFoodCatalogResolver(
        [new BlsStaticSource()],
        new DefaultConfidenceEngine(),
        DEFAULT_CATALOG_CONFIG,
        undefined,
        new NoopResolverRunLogger(),
      );
    }

    it('never accepts D771900 for the bare query "Brötchen", and never even lists it as a candidate', async () => {
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

    it('resolves the qualified query "Brötchen Blätterteig" to D771900, accepted', async () => {
      const decision = await buildResolver().resolve({
        raw: 'Brötchen Blätterteig',
        normalized: 'broetchen blaetterteig',
        locale: 'de',
        inputType: 'ambiguous',
      });

      expect(decision.status).toBe('accepted');
      expect(decision.best?.food.sourceId).toBe('D771900');
      expect(decision.reasonCodes).toContain('ACCEPTED_STRONG_MATCH');
    });

    it('resolves the qualified query "Brötchen (Blätterteig)" to D771900, accepted', async () => {
      const decision = await buildResolver().resolve({
        raw: 'Brötchen (Blätterteig)',
        normalized: 'broetchen blaetterteig',
        locale: 'de',
        inputType: 'ambiguous',
      });

      expect(decision.status).toBe('accepted');
      expect(decision.best?.food.sourceId).toBe('D771900');
    });
  });

  describe('production-call boundary (real DeterministicFoodParser -> resolver, LogFoodFromRawInputUseCase)', () => {
    const parser = new DeterministicFoodParser();

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
        parser,
        mockFoodCatalog as any,
        undefined,
        undefined,
        undefined,
        resolver as any,
      );
    }

    it('parses "Ein Brötchen" and "200g Brötchen" to the same food name the bare "Brötchen" query uses', () => {
      // Reuses the real parser's own output -- does not reimplement its stripping logic.
      const bare = parser.parse('Brötchen').name;
      const withArticle = parser.parse('Ein Brötchen').name;
      const withGrams = parser.parse('200g Brötchen').name;

      expect(withArticle).toBe(bare);
      expect(withGrams).toBe(bare);
    });

    it('never produces a D771900-sourced result for any of "Brötchen" / "Ein Brötchen" / "200g Brötchen"', async () => {
      // RESOLVER-V3-049 note: bare "Brötchen"'s remaining "-brötchen" candidates arise from
      // `BlsLookupEngine`'s single-long-token ranked-token-override branch (RESOLVER-V2-009's own
      // deliberate winner-picking system), which RESOLVER-V3-049's new preparation-state-ambiguity
      // check intentionally does not re-litigate -- see `SequentialFoodCatalogResolver.ts`'s
      // `eligibleForPreparationStateCheck` scoping note. This test's original behavior is
      // therefore unaffected by RESOLVER-V3-049.
      for (const rawInput of ['Brötchen', 'Ein Brötchen', '200g Brötchen']) {
        const useCase = buildUseCase();
        try {
          const entry = await useCase.execute({ rawText: rawInput, rawInput });
          expect(entry.foodCatalogRef?.sourceId).not.toBe('D771900');
        } catch (error: any) {
          // A count-without-explicit-grams input ("Ein Brötchen") can legitimately need a
          // portion-hint edit before macros are computed -- unrelated to this defect. Assert on
          // the resolved food identity carried in that error instead of the final entry.
          if (error?.code !== 'PORTION_GRAMS_REQUIRED_FOR_UNIT_INPUT') throw error;
          expect(error.needsEdit.displayName).not.toBe('Brötchen (Blätterteig)');
        }
      }
    });
  });

  describe('unaffected-record regression (other real (Blätterteig) parenthetical records)', () => {
    const cases: { label: string; qualifiedRaw: string; expectedSourceId: string }[] = [
      {
        label: 'Apfelstrudel (Blätterteig)',
        qualifiedRaw: 'Apfelstrudel (Blätterteig)',
        expectedSourceId: 'D4A1000',
      },
      {
        label: 'Apfeltasche (Blätterteig)',
        qualifiedRaw: 'Apfeltasche (Blätterteig)',
        expectedSourceId: 'D7A7800',
      },
      {
        label: 'Hörnchen (Blätterteig)',
        qualifiedRaw: 'Hörnchen (Blätterteig)',
        expectedSourceId: 'D771500',
      },
      {
        label: 'Mohnschnecken (Blätterteig)',
        qualifiedRaw: 'Mohnschnecken (Blätterteig)',
        expectedSourceId: 'D770100',
      },
    ];

    function buildResolver() {
      return new SequentialFoodCatalogResolver(
        [new BlsStaticSource()],
        new DefaultConfidenceEngine(),
        DEFAULT_CATALOG_CONFIG,
        undefined,
        new NoopResolverRunLogger(),
      );
    }

    for (const c of cases) {
      it(`${c.label}: real artifact contains ${c.expectedSourceId} and is unaffected by the D771900-scoped fix`, () => {
        const record = BLS_GENERIC_FOODS.find((r) => r.sourceId === c.expectedSourceId);
        expect(record).toBeDefined();
        expect(record?.incompatibleGenericQueries ?? []).toEqual([]);
      });

      it(`${c.label}: qualified query still resolves to ${c.expectedSourceId}, accepted`, async () => {
        const decision = await buildResolver().resolve({
          raw: c.qualifiedRaw,
          normalized: c.qualifiedRaw
            .toLowerCase()
            .replace(/[äöü]/g, (m) => ({ ä: 'ae', ö: 'oe', ü: 'ue' })[m] ?? m)
            .replace(/[()]/g, '')
            .replace(/\s+/g, ' ')
            .trim(),
          locale: 'de',
          inputType: 'ambiguous',
        });

        expect(decision.status).toBe('accepted');
        expect(decision.best?.food.sourceId).toBe(c.expectedSourceId);
      });
    }
  });
});
