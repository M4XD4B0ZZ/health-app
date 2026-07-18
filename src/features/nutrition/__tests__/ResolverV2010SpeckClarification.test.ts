import {
  LogFoodFromRawInputUseCase,
  SpeckAmbiguityError,
} from '../application/usecases/LogFoodFromRawInputUseCase';
import { InMemoryFoodEntryRepository } from '../infrastructure/repositories/InMemoryFoodEntryRepository';
import { DeterministicFoodParser } from '../infrastructure/parsers/DeterministicFoodParser';
import { TestIdGenerator } from '../infrastructure/RandomIdGenerator';
import { BlsStaticSource } from '../infrastructure/catalog/sources/BlsStaticSource';
import { SequentialFoodCatalogResolver } from '../application/services/SequentialFoodCatalogResolver';
import { DefaultConfidenceEngine } from '../domain/confidence/DefaultConfidenceEngine';
import { DEFAULT_CATALOG_CONFIG } from '../domain/models/FoodCatalogConfig';
import { buildSpeckChoiceResubmissionText } from '../domain/catalog/SpeckAmbiguity';

/**
 * RESOLVER-V2-010 — end-to-end against the real, committed BLS artifact (mirrors
 * BlsPlainGenericReachability.test.ts's construction: a real SequentialFoodCatalogResolver with
 * only BlsStaticSource, bypassing the globally-mocked DI container from test-setup.ts, whose
 * MockResolverBuilder happy path has no BLS "Speck" data at all). This is the only place the
 * three approved choices' preview values and the qualified-terms-stay-deterministic claim can
 * be proven — logResolvedNutritionInput.test.ts covers the architecture (detection, item shape,
 * multi-food coexistence) against the mocked container instead.
 */
class FixedClock {
  now(): Date {
    return new Date('2026-02-15T12:00:00Z');
  }
  todayISO(): string {
    return '2026-02-15';
  }
}

function buildRealUseCase(): LogFoodFromRawInputUseCase {
  const resolver = new SequentialFoodCatalogResolver(
    [new BlsStaticSource()],
    new DefaultConfidenceEngine(),
    DEFAULT_CATALOG_CONFIG,
  );
  const foodCatalog = { getById: async () => null, searchByName: async () => null };
  return new LogFoodFromRawInputUseCase(
    new InMemoryFoodEntryRepository(),
    new FixedClock(),
    new TestIdGenerator(),
    new DeterministicFoodParser(),
    foodCatalog,
    undefined,
    undefined,
    undefined,
    resolver,
    undefined,
  );
}

async function expectSpeckAmbiguity(
  useCase: LogFoodFromRawInputUseCase,
  input: { rawText: string; rawInput: string },
) {
  try {
    await useCase.execute(input);
    throw new Error('expected SpeckAmbiguityError to be thrown');
  } catch (err) {
    if (!(err instanceof SpeckAmbiguityError)) throw err;
    return err.clarification;
  }
}

describe('RESOLVER-V2-010 Speck clarification — real BLS resolver', () => {
  it('scenario A: "100 g Speck" — three choices, previews from the real resolved candidates, never W412000\'s 746 kcal by default', async () => {
    const useCase = buildRealUseCase();
    const clarification = await expectSpeckAmbiguity(useCase, {
      rawText: '100 g Speck',
      rawInput: '100 g Speck',
    });

    expect(clarification.rawInput).toBe('100 g Speck');
    expect(clarification.hasExplicitQuantity).toBe(true);
    expect(clarification.quantityGrams).toBe(100);

    const bauchspeck = clarification.choices.find((c) => c.id === 'bacon_bauchspeck');
    const fettspeck = clarification.choices.find((c) => c.id === 'fettspeck_rueckenspeck');
    const schinkenspeck = clarification.choices.find((c) => c.id === 'schinkenspeck');

    // Proven deterministic values (RESOLVER-V2-010 Act diagnostic): Bauchspeck -> W411300 (304
    // kcal/100g), Rückenspeck -> U605000 (746 kcal/100g, the SAME record class the current
    // silent default already targets — but here only as one explicit, informed choice, never
    // silently applied), Schinkenspeck -> a real lean-ham-cluster record.
    expect(bauchspeck?.previewCalories).toBe(304);
    expect(fettspeck?.previewCalories).toBe(746);
    expect(schinkenspeck?.previewCalories).toBeGreaterThan(100);
    expect(schinkenspeck?.previewCalories).toBeLessThan(200);
  });

  it('scenario B: bare "Speck" shows per-100g previews (no explicit quantity, no invented portion)', async () => {
    const useCase = buildRealUseCase();
    const clarification = await expectSpeckAmbiguity(useCase, {
      rawText: 'Speck',
      rawInput: 'Speck',
    });

    expect(clarification.hasExplicitQuantity).toBe(false);
    expect(clarification.quantityGrams).toBe(0);
    // Per-100g calories are identical whether or not a quantity was given, since the preview is
    // "per 100g" precisely when there is no explicit quantity to scale by.
    const fettspeck = clarification.choices.find((c) => c.id === 'fettspeck_rueckenspeck');
    expect(fettspeck?.previewCalories).toBe(746);
  });

  it.each([
    ['50 g Bauchspeck', 'W411300'],
    ['100 g Frühstücksspeck', undefined],
    ['100 g Schinkenspeck', undefined],
    ['100 g Rückenspeck', 'U605000'],
  ])(
    'qualified term "%s" bypasses clarification and resolves deterministically',
    async (input, expectedSourceId) => {
      const useCase = buildRealUseCase();
      const entry = await useCase.execute({ rawText: input, rawInput: input });

      expect(entry.calories).toBeGreaterThan(0);
      if (expectedSourceId) {
        expect(entry.foodCatalogRef?.sourceId).toBe(expectedSourceId);
      }
    },
  );

  it('"100 g Bacon" bypasses clarification (not "Speck") — existing behavior unchanged either way', async () => {
    const useCase = buildRealUseCase();
    // Bacon is not "speck" and must never be intercepted by the Speck ambiguity guard,
    // regardless of whether its own (separately-flagged, out-of-scope) resolution is correct.
    const entry = await useCase.execute({ rawText: '100 g Bacon', rawInput: '100 g Bacon' });
    expect(entry.calories).toBeGreaterThan(0);
  });

  it('W412000 is never silently selected for bare "Speck"', async () => {
    const useCase = buildRealUseCase();
    await expect(
      useCase.execute({ rawText: '100 g Speck', rawInput: '100 g Speck' }),
    ).rejects.toBeInstanceOf(SpeckAmbiguityError);
  });

  it('selecting a choice re-enters the qualified-term resolver path and preserves the original quantity', async () => {
    const useCase = buildRealUseCase();
    const clarification = await expectSpeckAmbiguity(useCase, {
      rawText: '100 g Speck',
      rawInput: '100 g Speck',
    });
    const bauchspeck = clarification.choices.find((c) => c.id === 'bacon_bauchspeck')!;

    const resubmissionText = buildSpeckChoiceResubmissionText(clarification.rawInput, bauchspeck);
    expect(resubmissionText).toBe('100 g bauchspeck');

    const entry = await useCase.execute({ rawText: resubmissionText, rawInput: resubmissionText });

    expect(entry.grams).toBe(100);
    expect(entry.calories).toBeCloseTo(bauchspeck.previewCalories!, 0);
    expect(entry.foodCatalogRef?.sourceId).toBe('W411300');
    expect(entry.foodCatalogRef?.source).toBe('bls');
    // The friendly label is never persisted as a fabricated identity — parsedName reflects the
    // real resolved query, and foodCatalogRef/nutritionSnapshot come straight from the resolver.
    expect(entry.parsedName).toBe('bauchspeck');
  });

  it('selecting a choice with no original quantity resolves per-100g default behavior (no new portion default introduced)', async () => {
    const useCase = buildRealUseCase();
    const clarification = await expectSpeckAmbiguity(useCase, {
      rawText: 'Speck',
      rawInput: 'Speck',
    });
    const schinkenspeck = clarification.choices.find((c) => c.id === 'schinkenspeck')!;

    const resubmissionText = buildSpeckChoiceResubmissionText(
      clarification.rawInput,
      schinkenspeck,
    );
    expect(resubmissionText).toBe('schinkenspeck');

    const entry = await useCase.execute({ rawText: resubmissionText, rawInput: resubmissionText });
    expect(entry.calories).toBeGreaterThan(0);
  });

  it('preview and persisted snapshot originate from the same resolved candidate (quantity not applied twice)', async () => {
    const useCase = buildRealUseCase();
    const clarification = await expectSpeckAmbiguity(useCase, {
      rawText: '50 g Speck',
      rawInput: '50 g Speck',
    });
    const fettspeck = clarification.choices.find((c) => c.id === 'fettspeck_rueckenspeck')!;
    expect(fettspeck.previewCalories).toBeCloseTo(373, 0); // half of 746 for 50g

    const resubmissionText = buildSpeckChoiceResubmissionText(clarification.rawInput, fettspeck);
    expect(resubmissionText).toBe('50 g rueckenspeck');
    const entry = await useCase.execute({ rawText: resubmissionText, rawInput: resubmissionText });

    expect(entry.grams).toBe(50);
    expect(entry.calories).toBeCloseTo(fettspeck.previewCalories!, 0);
  });

  it('a count/slice quantity ("3 Scheiben Speck") is preserved through selection, never dropped', async () => {
    const useCase = buildRealUseCase();
    const clarification = await expectSpeckAmbiguity(useCase, {
      rawText: '3 Scheiben Speck',
      rawInput: '3 Scheiben Speck',
    });
    const bauchspeck = clarification.choices.find((c) => c.id === 'bacon_bauchspeck')!;

    const resubmissionText = buildSpeckChoiceResubmissionText(clarification.rawInput, bauchspeck);
    expect(resubmissionText).toBe('3 Scheiben bauchspeck');

    // No known slice-portion hint exists for Bauchspeck today, so the existing
    // PortionNeedsEdit mechanism (not a fabricated conversion) is the truthful outcome — this
    // proves the count survives the resubmission rather than being silently dropped.
    await expect(
      useCase.execute({ rawText: resubmissionText, rawInput: resubmissionText }),
    ).rejects.toMatchObject({ name: 'PortionNeedsEditError' });
  });
});
