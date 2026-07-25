import {
  BLS_GENERIC_FOODS,
  searchBlsGenericFoods,
} from '../infrastructure/catalog/sources/blsGenericFoods';
import { hasBlsGenericPreparationStateConflict } from '../infrastructure/catalog/sources/bls/BlsLookupEngine';
import { BlsStaticSource } from '../infrastructure/catalog/sources/BlsStaticSource';
import { SequentialFoodCatalogResolver } from '../application/services/SequentialFoodCatalogResolver';
import { DefaultConfidenceEngine } from '../domain/confidence/DefaultConfidenceEngine';
import { DEFAULT_CATALOG_CONFIG } from '../domain/models/FoodCatalogConfig';
import { NoopResolverRunLogger } from '../application/ports/ResolverRunLogger';
import { DeterministicFoodParser } from '../infrastructure/parsers/DeterministicFoodParser';
import { LogFoodFromRawInputUseCase } from '../application/usecases/LogFoodFromRawInputUseCase';
import { InMemoryFoodEntryRepository } from '../infrastructure/repositories/InMemoryFoodEntryRepository';
import { normalizeText } from '../application/utils/normalizeText';

/**
 * RESOLVER-V3-049: permanent regression coverage for the three owned BLS generic fast-path
 * false-confidence cases RESOLVER-V3-043 Phase A diagnosed but deferred (see
 * `reports/RESOLVER_V3_043_UNSAFE_FAST_PATH_FALSE_CONFIDENCE_DIAGNOSIS.md` §6):
 *
 * - `RH-RES-PREPARATION-DEV-002` ("Haferflocken"): two exact-tied candidates, raw 348 kcal
 *   (C133000) vs. cooked 66 kcal (C133032) -- both already visible to the search stage, but the
 *   resolver's score-delta accept path (0.107 gap, exceeding the existing 0.08
 *   `DELTA_THRESHOLD`) silently accepted the raw candidate.
 * - `RH-RES-PREPARATION-DEV-004` ("Pommes frites"): a single exact-alias record (X654042,
 *   239 kcal) pre-empted a 3-variant frozen-fries family (K130200/K130262/K130492,
 *   123/167/203 kcal) via `BlsLookupEngine`'s Stage-1 short-circuit -- they were never even
 *   scored.
 * - `RH-RES-PREPARATION-HOLD-002` ("Pommes"): 3 token-matched near-tied candidates
 *   (K130200/K130262/K130492) already visible, but silently accepted via the same score-delta
 *   accept path (0.095 gap).
 *
 * Root causes (two independent defects -- see ROADMAP.md's RESOLVER-V3-049 entry):
 * 1. Search-stage visibility: `BlsLookupEngine.search()`'s Stage-1 exact-match short-circuit can
 *    return a single record even when other, materially plausible same-family preparation-state
 *    siblings exist and are never scored (`findFamilyExtensionMatches`).
 * 2. Resolver acceptance: the BLS generic fast-path in `SequentialFoodCatalogResolver.ts` applied
 *    no ambiguity check beyond a raw score delta, which a semantic ranking multiplier can clear
 *    even when the winning margin reflects a *designed* raw-vs-prepared ranking preference, not
 *    genuine confidence that the unqualified query meant one variant over the other
 *    (`hasBlsGenericPreparationStateConflict`).
 *
 * Fix: a categorical, source-grounded preparation-state-qualifier policy (not a reverse-engineered
 * score threshold) -- reuses the existing `PROCESSED_QUALIFIER_TOKENS` lexicon that already
 * governs BLS Stage-2 ranked-token scoring, extended with explicit frozen-state markers. A bare,
 * unqualified query whose competing BLS candidates disagree on preparation state no longer
 * silently accepts one; it resolves an honest `ambiguous` with no `best` (so no downstream caller
 * can still treat it as confidently resolved). A query that itself already names a preparation
 * qualifier remains fully resolvable.
 */
describe('RESOLVER-V3-049: BLS generic fast-path ambiguity policy', () => {
  describe('BlsLookupEngine / blsGenericFoods boundary (real compact runtime artifact)', () => {
    it('Haferflocken: both raw and cooked exact-tied candidates are visible with materially divergent macros', () => {
      const results = searchBlsGenericFoods('haferflocken');

      expect(results.length).toBe(2);
      const raw = results.find((r) => r.food.sourceId === 'C133000');
      const cooked = results.find((r) => r.food.sourceId === 'C133032');
      expect(raw).toBeDefined();
      expect(cooked).toBeDefined();
      expect(raw?.match.exact).toBe(true);
      expect(cooked?.match.exact).toBe(true);
      expect(raw?.food.macrosPer100g.kcal).toBe(348);
      expect(cooked?.food.macrosPer100g.kcal).toBe(66);
      // Materially divergent: raw is > 5x cooked's kcal density.
      expect(
        (raw?.food.macrosPer100g.kcal ?? 0) / (cooked?.food.macrosPer100g.kcal ?? 1),
      ).toBeGreaterThan(4);
    });

    it('Pommes frites: Stage-1 exact match no longer hides the frozen-fries family behind its short-circuit', () => {
      const results = searchBlsGenericFoods('pommes frites');
      const sourceIds = results.map((r) => r.food.sourceId);

      expect(sourceIds).toContain('X654042'); // the single exact-alias record (239 kcal)
      expect(sourceIds).toContain('K130200'); // plain frozen (123 kcal)
      expect(sourceIds).toContain('K130262'); // frozen, gebacken (167 kcal)
      expect(sourceIds).toContain('K130492'); // frozen, frittiert (203 kcal)
      expect(results.length).toBeGreaterThanOrEqual(4);

      const kcals = results.map((r) => r.food.macrosPer100g.kcal);
      expect(Math.max(...kcals) - Math.min(...kcals)).toBeGreaterThan(70);
    });

    it('Pommes: 3 token-matched near-tied frozen-fries candidates are visible with divergent macros', () => {
      const results = searchBlsGenericFoods('pommes');
      const sourceIds = results.map((r) => r.food.sourceId);

      expect(sourceIds).toEqual(expect.arrayContaining(['K130200', 'K130262', 'K130492']));
      const kcals = ['K130200', 'K130262', 'K130492'].map(
        (id) => results.find((r) => r.food.sourceId === id)?.food.macrosPer100g.kcal,
      );
      expect(new Set(kcals).size).toBe(3);
    });

    it('unrelated hyphen-fused compound products are never pulled in as family extensions of a plain exact match', () => {
      // "Quark-Frucht-Plunder" et al. are one fused word (a sweet pastry, ~378 kcal), not "Quark"
      // (66 kcal) plus a preparation qualifier -- must never appear for the bare "quark" query.
      const results = searchBlsGenericFoods('quark');
      const sourceIds = results.map((r) => r.food.sourceId);

      expect(sourceIds).toEqual(['M713100']);
      expect(sourceIds).not.toContain('D7A7510'); // Quark-Frucht-Plunder
      expect(sourceIds).not.toContain('D7A7500'); // Quark-Plunder
    });

    it('"mit"-clause ingredient additions are never pulled in as family extensions', () => {
      // "Rührei gebraten in Butter" adds an unrecognized ingredient ("butter"), not a recognized
      // preparation-state qualifier -- must not be pulled in behind the plain "Rührei" exact match.
      const results = searchBlsGenericFoods('ruehrei');

      expect(results.length).toBe(1);
      expect(results[0].food.sourceId).toBe('Y720143');
    });

    it('hasBlsGenericPreparationStateConflict: detects conflict for unqualified queries whose candidates disagree on preparation state and diverge materially', () => {
      expect(
        hasBlsGenericPreparationStateConflict('haferflocken', [
          { normalizedName: 'hafer flocken', kcalPer100g: 348 },
          { normalizedName: 'hafer flocken gekocht', kcalPer100g: 66 },
        ]),
      ).toBe(true);
      expect(
        hasBlsGenericPreparationStateConflict('pommes', [
          { normalizedName: 'pommes frites tiefgefroren', kcalPer100g: 123 },
          { normalizedName: 'pommes frites tiefgefroren gebacken', kcalPer100g: 167 },
          { normalizedName: 'pommes frites tiefgefroren frittiert', kcalPer100g: 203 },
        ]),
      ).toBe(true);
    });

    it('hasBlsGenericPreparationStateConflict: exempts a query that already contains the qualifier', () => {
      expect(
        hasBlsGenericPreparationStateConflict('hafer flocken gekocht', [
          { normalizedName: 'hafer flocken gekocht', kcalPer100g: 66 },
        ]),
      ).toBe(false);
      expect(
        hasBlsGenericPreparationStateConflict('pommes frites tiefgefroren gebacken', [
          { normalizedName: 'pommes frites tiefgefroren gebacken', kcalPer100g: 167 },
        ]),
      ).toBe(false);
    });

    it('hasBlsGenericPreparationStateConflict: false for a single candidate or for candidates that agree', () => {
      expect(
        hasBlsGenericPreparationStateConflict('quark', [
          { normalizedName: 'quark', kcalPer100g: 66 },
        ]),
      ).toBe(false);
      expect(
        hasBlsGenericPreparationStateConflict('ruehrei', [
          { normalizedName: 'ruehrei gebraten', kcalPer100g: 203 },
        ]),
      ).toBe(false);
    });

    it('hasBlsGenericPreparationStateConflict: false when candidates disagree on preparation state but diverge only negligibly (e.g. raw vs. boiled egg)', () => {
      expect(
        hasBlsGenericPreparationStateConflict('eier', [
          { normalizedName: 'eier', kcalPer100g: 137 },
          { normalizedName: 'eier gekocht', kcalPer100g: 135 },
        ]),
      ).toBe(false);
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

    const ownedCases: { label: string; raw: string }[] = [
      { label: 'RH-RES-PREPARATION-DEV-002 (Haferflocken)', raw: 'Haferflocken' },
      { label: 'RH-RES-PREPARATION-DEV-004 (Pommes frites)', raw: 'Pommes frites' },
      { label: 'RH-RES-PREPARATION-HOLD-002 (Pommes)', raw: 'Pommes' },
    ];

    for (const { label, raw } of ownedCases) {
      it(`${label}: never produces a false-confident accepted result`, async () => {
        const normalized = normalizeText(raw);
        const decision = await buildResolver().resolve({
          raw,
          normalized,
          locale: 'de',
          inputType: 'generic',
        });

        expect(decision.status).not.toBe('accepted');
        expect(decision.best).toBeUndefined();
        expect(decision.candidates.length).toBeGreaterThan(1);
      });
    }

    it('Haferflocken: resolves ambiguous with BLS_GENERIC_PREPARATION_STATE_AMBIGUITY and both real candidates listed', async () => {
      const decision = await buildResolver().resolve({
        raw: 'Haferflocken',
        normalized: 'haferflocken',
        locale: 'de',
        inputType: 'generic',
      });

      expect(decision.status).toBe('ambiguous');
      expect(decision.reasonCodes).toContain('BLS_GENERIC_PREPARATION_STATE_AMBIGUITY');
      const sourceIds = decision.candidates.map((c) => c.food.sourceId);
      expect(sourceIds).toEqual(expect.arrayContaining(['C133000', 'C133032']));
    });

    it('Pommes frites: resolves ambiguous with the previously-hidden frozen-fries family visible', async () => {
      const decision = await buildResolver().resolve({
        raw: 'Pommes frites',
        normalized: 'pommes frites',
        locale: 'de',
        inputType: 'generic',
      });

      expect(decision.status).toBe('ambiguous');
      expect(decision.reasonCodes).toContain('BLS_GENERIC_PREPARATION_STATE_AMBIGUITY');
      const sourceIds = decision.candidates.map((c) => c.food.sourceId);
      expect(sourceIds).toEqual(
        expect.arrayContaining(['X654042', 'K130200', 'K130262', 'K130492']),
      );
    });

    it('Pommes: resolves ambiguous', async () => {
      const decision = await buildResolver().resolve({
        raw: 'Pommes',
        normalized: 'pommes',
        locale: 'de',
        inputType: 'generic',
      });

      expect(decision.status).toBe('ambiguous');
      expect(decision.reasonCodes).toContain('BLS_GENERIC_PREPARATION_STATE_AMBIGUITY');
    });

    describe('qualified variants of the owned cases remain fully resolvable', () => {
      const qualifiedCases: {
        label: string;
        raw: string;
        expectedSourceId: string;
        expectedKcal: number;
      }[] = [
        {
          label: 'Hafer Flocken, gekocht',
          raw: 'Hafer Flocken, gekocht',
          expectedSourceId: 'C133032',
          expectedKcal: 66,
        },
        {
          label: 'Pommes frites tiefgefroren, gebacken',
          raw: 'Pommes frites tiefgefroren, gebacken',
          expectedSourceId: 'K130262',
          expectedKcal: 167,
        },
        {
          label: 'Pommes frites tiefgefroren, frittiert',
          raw: 'Pommes frites tiefgefroren, frittiert',
          expectedSourceId: 'K130492',
          expectedKcal: 203,
        },
      ];

      for (const { label, raw, expectedSourceId, expectedKcal } of qualifiedCases) {
        it(`${label}: resolves accepted to ${expectedSourceId}`, async () => {
          const decision = await buildResolver().resolve({
            raw,
            normalized: normalizeText(raw),
            locale: 'de',
            inputType: 'generic',
          });

          expect(decision.status).toBe('accepted');
          expect(decision.best?.food.sourceId).toBe(expectedSourceId);
          expect(decision.best?.food.macrosPer100g.kcal).toBe(expectedKcal);
        });
      }
    });

    describe('positive controls: pre-existing accepted BLS generic fast-path outcomes are unaffected', () => {
      const controls: { label: string; raw: string; expectedSourceId: string }[] = [
        { label: 'Quark', raw: 'Quark', expectedSourceId: 'M713100' },
        { label: 'Magerquark', raw: 'Magerquark', expectedSourceId: 'M713100' },
        { label: 'Rührei', raw: 'Rührei', expectedSourceId: 'Y720143' },
        {
          label: 'Brötchen Blätterteig (RESOLVER-V3-043 Phase A)',
          raw: 'Brötchen Blätterteig',
          expectedSourceId: 'D771900',
        },
        {
          label: 'Eier (raw vs. boiled diverge only ~1.5%, immaterial)',
          raw: 'Eier',
          expectedSourceId: 'Y720100',
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
          expect(decision.reasonCodes).toContain('ACCEPTED_STRONG_MATCH');
        });
      }

      // Speck's own resolver-level "winner" (pre-existing MULTIPLE_CLOSE_MATCHES status, best
      // still populated) is untouched by this task's new preparation-state check -- the 660/746
      // kcal spread across its own top-3 (roh/roh/geräuchert) is only ~13%, below this task's
      // materiality floor, so `hasBlsGenericPreparationStateConflict` never even engages here.
      // RESOLVER-V2-010's dedicated pre-resolver Speck clarification (`isGenericSpeckQuery` in
      // `LogFoodFromRawInputUseCase`) remains the sole, approved disambiguation mechanism for bare
      // "Speck" in production -- this task does not add a second, conflicting one.
      it('Speck: resolver-level winner (W412000) is unaffected; status/reasonCode are pre-existing, untouched by this task', async () => {
        const decision = await buildResolver().resolve({
          raw: 'Speck',
          normalized: normalizeText('Speck'),
          locale: 'de',
          inputType: 'generic',
        });

        expect(decision.best?.food.sourceId).toBe('W412000');
        expect(decision.reasonCodes).not.toContain('BLS_GENERIC_PREPARATION_STATE_AMBIGUITY');
      });

      // RESOLVER-V2-010's three qualified Speck clarification choices must stay deterministic
      // (explicit, approved product decision -- plans/RESOLVER-V2-010_SPECK_DISAMBIGUATION_DECISION_PLAN.md).
      // "Schinkenspeck" resolves via a genuine Stage-1 exact tie (roh/geschmort/gebraten
      // sub-records of the same cut, 127/167/156 kcal, ratio 1.31) that sits below this task's
      // materiality floor (1.4) -- ordinary same-cut cooking-method variance, not a different-
      // identity conflict. "Bauchspeck"/"Rückenspeck" resolve via the ranked-token-override branch
      // this task's check does not re-litigate (see `eligibleForPreparationStateCheck`).
      const speckSubTerms: { label: string; raw: string; expectedSourceId: string }[] = [
        { label: 'Bauchspeck', raw: 'Bauchspeck', expectedSourceId: 'W411300' },
        { label: 'Schinkenspeck', raw: 'Schinkenspeck', expectedSourceId: 'U685142' },
        { label: 'Rückenspeck', raw: 'Rückenspeck', expectedSourceId: 'U605000' },
      ];
      for (const { label, raw, expectedSourceId } of speckSubTerms) {
        it(`${label}: remains deterministic (RESOLVER-V2-010 qualified Speck sub-term, never ambiguous)`, async () => {
          const decision = await buildResolver().resolve({
            raw,
            normalized: normalizeText(raw),
            locale: 'de',
            inputType: 'generic',
          });

          expect(decision.best?.food.sourceId).toBe(expectedSourceId);
          expect(decision.reasonCodes).not.toContain('BLS_GENERIC_PREPARATION_STATE_AMBIGUITY');
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

    const ownedRawInputs = ['Haferflocken', 'Pommes frites', 'Pommes'];

    for (const rawInput of ownedRawInputs) {
      it(`${rawInput}: never silently persists a confidently-resolved food entry (honest non-accepted result)`, async () => {
        const useCase = buildUseCase();

        await expect(useCase.execute({ rawText: rawInput, rawInput })).rejects.toThrow(
          /RESOLVER_FAILED_OR_NO_MACROS/,
        );
      });
    }

    it('a qualified variant ("Hafer Flocken, gekocht") still resolves and persists real macros through the full production boundary', async () => {
      const useCase = buildUseCase();
      const entry = await useCase.execute({
        rawText: 'Hafer Flocken, gekocht',
        rawInput: 'Hafer Flocken, gekocht',
      });

      expect(entry.foodCatalogRef?.sourceId).toBe('C133032');
      expect(entry.calories).toBeGreaterThan(0);
    });
  });

  describe('unaffected: existing V3-043-protected and unrelated (Blätterteig) parenthetical records', () => {
    const otherBlaetterteigSourceIds = ['D4A1000', 'D7A7800', 'D771500', 'D770100'];

    it('none of the other real (Blätterteig) records were touched by this task', () => {
      for (const sourceId of otherBlaetterteigSourceIds) {
        const record = BLS_GENERIC_FOODS.find((r) => r.sourceId === sourceId);
        expect(record).toBeDefined();
        expect(record?.incompatibleGenericQueries ?? []).toEqual([]);
      }
    });
  });
});
