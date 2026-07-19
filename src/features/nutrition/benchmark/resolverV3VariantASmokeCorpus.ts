import { BenchmarkCase, BenchmarkCorpusManifest } from './BenchmarkCaseTypes';

/**
 * RESOLVER-V3-003: initial, committed, versioned benchmark corpus for the Variant-A (current
 * Zera resolver) baseline harness.
 *
 * Scope (see ROADMAP.md RESOLVER-V3-003 + docs/domains/ZERA_FOOD_RESOLUTION_BENCHMARK_SPEC_1.md
 * §4): this is the initial *smoke* subset, not the full ~150-200 case comparison corpus planned
 * for RESOLVER-V3-004/005/006. 14 cases instead of the spec's ~25-case smoke-subset target,
 * because every case below is backed by *real, reproduced* evidence (see `groundTruthProvenance`/
 * `reproducibilityNotes` per case) rather than invented filler -- expansion toward the full
 * smoke-subset size is a controlled follow-up, not done here (task instruction: "Vermeide
 * Testdaten, die nur deshalb gewählt werden, weil Variante A sie bereits besteht" -- several
 * cases below are evidence-based *failures* for Variant A, not curated wins).
 *
 * Every ground-truth value was reproduced on 2026-07-19 against the committed BLS runtime
 * artifact (`bls-runtime-compact.v1.json`, BLS 4.0 2025 DE) via the real
 * `SequentialFoodCatalogResolver` + `BlsStaticSource` call path (the same path
 * `ResolverV3VariantAAdapter.ts` uses), using a throwaway diagnostic test deleted after tracing
 * -- the same reproducible method RESOLVER-V2-008 used (see
 * reports/RESOLVER-V2-008_GENERIC_FOOD_TRUST_DIAGNOSIS.md §0). No numeric value below was
 * invented; four cases (Himbeeren, Haferflocken, Magerquark, Speck) reuse the exact cases
 * RESOLVER-V2-008/V2-009 already proved.
 */

export const RESOLVER_V3_VARIANT_A_CORPUS_MANIFEST: BenchmarkCorpusManifest = {
  corpusVersion: '1.0.0',
  description:
    'RESOLVER-V3-003 initial smoke subset for the Variant-A (current resolver) baseline harness.',
  changelog: [
    {
      version: '1.0.0',
      date: '2026-07-19',
      summary:
        '14 initial cases: SIMPLE/DACH BLS-generic hits (Quark, Magerquark, Ei/Eier repeat pair, ' +
        'Toast, Haferflocken), the RESOLVER-V2-008/009-proven Himbeeren case, the RESOLVER-V2-010 ' +
        'Speck ambiguity, three newly-traced real defects (Tomate, Gurke, Brötchen -- resolver ' +
        'confidently selects the wrong candidate), one legitimate acceptable-ambiguity case ' +
        '(Reis), and one honest-abstention DACH regional-dish case (Zwiebelrostbraten, no ' +
        "numeric ground truth per ROADMAP.md's explicit instruction not to invent one).",
    },
  ],
};

export const RESOLVER_V3_VARIANT_A_SMOKE_CORPUS: readonly BenchmarkCase[] = [
  {
    caseId: 'RV3-0001',
    corpusVersion: '1.0.0',
    category: 'SIMPLE',
    difficulty: 'easy',
    rawInput: 'Quark',
    locale: 'de',
    expectedComponents: [
      {
        componentId: 'c1',
        expectedName: 'Speisequark Magerstufe',
        expectedQuantity: { value: 200, unit: 'g' },
        required: true,
        expectedSourceId: 'M713100',
        expectedSourceType: 'bls',
      },
    ],
    groundTruthSource: 'bls_generic',
    groundTruthProvenance:
      'BLS 4.0 2025 DE, committed artifact bls-runtime-compact.v1.json, sourceId M713100 ' +
      '("Speisequark Magerstufe, Magerquark < 10 % Fett i. Tr."). Reused from ' +
      'docs/domains/ZERA_FOOD_RESOLUTION_BENCHMARK_SPEC_1.md §2.4 Example 1, whose numeric ' +
      "placeholder is filled in here per that document's own deferral.",
    referenceNutrients: { kcal: 66, protein_g: 11.85, fat_g: 0.18, carbs_g: 3.68 },
    expectedBehavior: 'direct_resolution',
    criticalFailureConditions: [
      'Auflösung auf ein verarbeitetes Quark-Dessert statt des generischen Speisequarks',
    ],
    reproducibilityNotes:
      'Reproduced 2026-07-19 via SequentialFoodCatalogResolver+BlsStaticSource: status=accepted, ' +
      'single candidate M713100 (alias overlay in BlsCompactRuntimeAdapter.ts maps "quark" onto it).',
    personalDataFree: true,
    repeatGroupId: 'quark-magerquark-synonym',
    tags: ['bls-generic', 'benchmark-spec-example-1'],
  },
  {
    caseId: 'RV3-0002',
    corpusVersion: '1.0.0',
    category: 'DACH',
    difficulty: 'easy',
    rawInput: 'Magerquark',
    locale: 'de',
    expectedComponents: [
      {
        componentId: 'c1',
        expectedName: 'Speisequark Magerstufe, Magerquark < 10 % Fett i. Tr.',
        expectedQuantity: { value: 200, unit: 'g' },
        required: true,
        expectedSourceId: 'M713100',
        expectedSourceType: 'bls',
      },
    ],
    groundTruthSource: 'bls_generic',
    groundTruthProvenance:
      'BLS 4.0 2025 DE, sourceId M713100 -- identical record to RV3-0001 ("quark"), reached ' +
      'here via the exact-match alias for the full word "magerquark" rather than the overlay. ' +
      'Also asserted by the existing regression test BlsPlainGenericReachability.test.ts and ' +
      'documented in reports/RESOLVER-V2-008_GENERIC_FOOD_TRUST_DIAGNOSIS.md §2.4/§3.3.',
    referenceNutrients: { kcal: 66, protein_g: 11.85, fat_g: 0.18, carbs_g: 3.68 },
    expectedBehavior: 'direct_resolution',
    criticalFailureConditions: [
      'Auflösung auf eine andere Quarksorte oder ein Dessert statt Magerquark selbst',
    ],
    reproducibilityNotes:
      'Reproduced 2026-07-19: status=accepted, single exact-match candidate M713100.',
    personalDataFree: true,
    repeatGroupId: 'quark-magerquark-synonym',
    tags: ['bls-generic', 'dach-regional', 'resolver-v2-008'],
    notes:
      'Paired with RV3-0001 as a synonym/paraphrase repeat-consistency pair (spec §3 ' +
      'REPEAT_CONSISTENCY overlay): "Quark" and "Magerquark" are expected to resolve to the same ' +
      'canonical identity.',
  },
  {
    caseId: 'RV3-0003',
    corpusVersion: '1.0.0',
    category: 'SIMPLE',
    difficulty: 'easy',
    rawInput: 'Ei',
    locale: 'de',
    expectedComponents: [
      {
        componentId: 'c1',
        expectedName: 'Huehnerei ganz roh',
        expectedQuantity: { value: 1, unit: 'piece' },
        required: true,
        expectedSourceId: 'Y720100',
        expectedSourceType: 'bls',
      },
    ],
    groundTruthSource: 'bls_generic',
    groundTruthProvenance:
      'BLS 4.0 2025 DE, sourceId Y720100 ("Huehnerei ganz roh"), reproduced 2026-07-19.',
    referenceNutrients: { kcal: 137, protein_g: 11.9, fat_g: 9.3, carbs_g: 1.5 },
    expectedBehavior: 'direct_resolution',
    criticalFailureConditions: [
      'Auflösung auf ein anderes Ei (Wachtel/Enten/Putenei) statt Hühnerei',
    ],
    reproducibilityNotes: 'Reproduced 2026-07-19: status=accepted, single exact-match candidate.',
    personalDataFree: true,
    repeatGroupId: 'ei-eier-plural',
    tags: ['bls-generic', 'simple'],
  },
  {
    caseId: 'RV3-0004',
    corpusVersion: '1.0.0',
    category: 'HOUSEHOLD',
    difficulty: 'easy',
    rawInput: 'Eier',
    locale: 'de',
    expectedComponents: [
      {
        componentId: 'c1',
        expectedName: 'Huehnerei ganz roh',
        expectedQuantity: { value: 3, unit: 'piece', householdMeasure: '3 Eier' },
        required: true,
        expectedSourceId: 'Y720100',
        expectedSourceType: 'bls',
      },
    ],
    groundTruthSource: 'bls_generic',
    groundTruthProvenance: 'Identical BLS record to RV3-0003 (Y720100), reproduced 2026-07-19.',
    referenceNutrients: { kcal: 137, protein_g: 11.9, fat_g: 9.3, carbs_g: 1.5 },
    expectedBehavior: 'direct_resolution',
    criticalFailureConditions: [
      'Plural "Eier" darf nicht auf ein anderes Produkt (z. B. Eierlikör) fixieren',
    ],
    reproducibilityNotes:
      'Reproduced 2026-07-19: status=accepted, single exact-match candidate identical to the ' +
      'singular form -- confirms plural/singular consistency for this food.',
    personalDataFree: true,
    repeatGroupId: 'ei-eier-plural',
    tags: ['bls-generic', 'household-piece-unit'],
    notes:
      'Paired with RV3-0003 as a singular/plural repeat-consistency pair (spec §3 ' +
      'REPEAT_CONSISTENCY overlay pattern: "Zahlwort vs. Ziffer, Singular/Plural").',
  },
  {
    caseId: 'RV3-0005',
    corpusVersion: '1.0.0',
    category: 'SIMPLE',
    difficulty: 'easy',
    rawInput: 'Toast',
    locale: 'de',
    expectedComponents: [
      {
        componentId: 'c1',
        expectedName: 'Weizentoastbrot/Buttertoastbrot',
        expectedQuantity: { value: 2, unit: 'piece', householdMeasure: '2 Scheiben' },
        required: true,
        expectedSourceId: 'B314000',
        expectedSourceType: 'bls',
      },
    ],
    groundTruthSource: 'bls_generic',
    groundTruthProvenance: 'BLS 4.0 2025 DE, sourceId B314000, reproduced 2026-07-19.',
    referenceNutrients: { kcal: 261, protein_g: 8.29, fat_g: 3.59, carbs_g: 46.8 },
    expectedBehavior: 'direct_resolution',
    criticalFailureConditions: ['Auflösung auf ein anderes Brot statt Toastbrot'],
    reproducibilityNotes: 'Reproduced 2026-07-19: status=accepted, single exact-match candidate.',
    personalDataFree: true,
    tags: ['bls-generic', 'composed-building-block'],
    notes:
      'The raw phrase intentionally echoes the "Zwei Scheiben Toast mit Butter und Gouda" ' +
      'component already used in AiInterpretationProvider.test.ts (spec §2.4 Example 3), but this ' +
      'case tests only the single "Toast" component -- RESOLVER-V3-003 calls ' +
      '`SequentialFoodCatalogResolver` directly, which resolves one food-name query at a time and ' +
      'does not itself perform multi-component decomposition (that lives upstream, in the ' +
      'LogFoodFromRawInputUseCase/parser layer). A true multi-item COMPOSED case is out of scope ' +
      'for this resolver-only harness; see the harness README for this documented boundary.',
  },
  {
    caseId: 'RV3-0006',
    corpusVersion: '1.0.0',
    category: 'DACH',
    subcategory: 'plain-generic-reachability',
    difficulty: 'medium',
    rawInput: 'Haferflocken',
    locale: 'de',
    expectedComponents: [
      {
        componentId: 'c1',
        expectedName: 'Hafer Flocken',
        expectedQuantity: { value: 100, unit: 'g' },
        required: true,
        expectedSourceId: 'C133000',
        expectedSourceType: 'bls',
      },
    ],
    groundTruthSource: 'bls_generic',
    groundTruthProvenance:
      'BLS 4.0 2025 DE, sourceId C133000 ("Hafer Flocken"), reproduced 2026-07-19 and already ' +
      'regression-protected by BlsPlainGenericReachability.test.ts (RESOLVER-V2-009 fix).',
    referenceNutrients: { kcal: 348, protein_g: 13.22, fat_g: 6.65, carbs_g: 53.3 },
    expectedBehavior: 'direct_resolution',
    criticalFailureConditions: [
      'Rückfall auf die vor RESOLVER-V2-009 bewiesene Fehlauflösung (Milchsuppe X475243, 102 kcal)',
    ],
    reproducibilityNotes:
      'Reproduced 2026-07-19: status=accepted, top candidate C133000; a second, lower-scored ' +
      'candidate (cooked variant) also present but does not change the winner.',
    personalDataFree: true,
    tags: ['dach-regional', 'resolver-v2-009', 'proven-fix-regression'],
  },
  {
    caseId: 'RV3-0007',
    corpusVersion: '1.0.0',
    category: 'DACH',
    subcategory: 'plain-generic-reachability',
    difficulty: 'medium',
    rawInput: 'Himbeeren',
    locale: 'de',
    expectedComponents: [
      {
        componentId: 'c1',
        expectedName: 'Himbeere roh',
        expectedQuantity: { value: 100, unit: 'g' },
        required: true,
        expectedSourceId: 'F302100',
        expectedSourceType: 'bls',
      },
    ],
    groundTruthSource: 'bls_generic',
    groundTruthProvenance:
      'BLS 4.0 2025 DE, sourceId F302100 ("Himbeere roh"), reproduced 2026-07-19. Proven in ' +
      'reports/RESOLVER-V2-008_GENERIC_FOOD_TRUST_DIAGNOSIS.md and regression-protected by ' +
      'BlsPlainGenericReachability.test.ts (RESOLVER-V2-009 fix).',
    referenceNutrients: { kcal: 43, protein_g: 1, fat_g: 0.3, carbs_g: 5.2 },
    expectedBehavior: 'direct_resolution',
    criticalFailureConditions: [
      'Rückfall auf die vor RESOLVER-V2-009 bewiesene Fehlauflösung (Nussbiskuitrolle D3A4000, 275 kcal)',
    ],
    reproducibilityNotes:
      'Reproduced 2026-07-19: the correct record (F302100) IS the top-ranked candidate, but the ' +
      'resolver\'s own `status` is "ambiguous" (MULTIPLE_CLOSE_MATCHES) because two other BLS ' +
      'candidates tie its ScoreCalculator score at 1.0 -- a real, currently-observed ' +
      'expected-behavior mismatch (unnecessary ambiguity flag on an otherwise-correct top-1 ' +
      "match), documented transparently rather than smoothed over (see harness README's " +
      '"resolver status mapping" section).',
    personalDataFree: true,
    tags: ['dach-regional', 'resolver-v2-008', 'resolver-v2-009', 'ambiguous-status-quirk'],
  },
  {
    caseId: 'RV3-0008',
    corpusVersion: '1.0.0',
    category: 'DACH',
    subcategory: 'speck-ambiguity',
    difficulty: 'hard',
    rawInput: 'Speck',
    locale: 'de',
    expectedComponents: [
      {
        componentId: 'c1',
        expectedName:
          'Speck (mehrdeutig: Bauchspeck/Bacon, Rückenspeck/Fettspeck, oder Schinkenspeck)',
        required: true,
      },
    ],
    groundTruthSource: 'no_numeric_ground_truth',
    groundTruthProvenance: undefined,
    referenceNutrients: null,
    expectedBehavior: 'clarification_required',
    expectedClarificationKind: 'ambiguous_food_identity',
    criticalFailureConditions: [
      'Bare "Speck" darf nicht ungefragt/scheinsicher auf einen der drei materiell verschiedenen ' +
        'BLS-Cluster (roher Aufschmelzspeck ~660-746 kcal, Bacon-artiger Bauchspeck ~287-337 kcal, ' +
        'magerer Schinkenspeck ~121-167 kcal) fixiert werden, ohne die Mehrdeutigkeit sichtbar zu machen',
    ],
    reproducibilityNotes:
      'Reproduced 2026-07-19 against the same three BLS candidates already documented in ' +
      'reports/RESOLVER-V2-008_GENERIC_FOOD_TRUST_DIAGNOSIS.md §2.3 and plans/' +
      'RESOLVER-V2-010_SPECK_DISAMBIGUATION_DECISION_PLAN.md: status="ambiguous" ' +
      '(MULTIPLE_CLOSE_MATCHES), best=W412000 (746 kcal). The dedicated clarification UX ' +
      '(SpeckAmbiguity.ts, RESOLVER-V2-010) sits one layer above SequentialFoodCatalogResolver, in ' +
      'the raw-input parsing step -- RESOLVER-V3-003 evaluates only the resolver boundary per its ' +
      'ROADMAP scope, so this case documents that the resolver\'s own "ambiguous" status is the ' +
      'closest available signal to "needs clarification", not a literal clarification question.',
    personalDataFree: true,
    tags: ['dach-regional', 'known-ambiguity', 'resolver-v2-010', 'speck-ambiguity'],
  },
  {
    caseId: 'RV3-0009',
    corpusVersion: '1.0.0',
    category: 'SIMPLE',
    difficulty: 'medium',
    rawInput: 'Tomate',
    locale: 'de',
    expectedComponents: [
      {
        componentId: 'c1',
        expectedName: 'Tomate roh',
        expectedQuantity: { value: 100, unit: 'g' },
        required: true,
        expectedSourceId: 'G561100',
        expectedSourceType: 'bls',
      },
    ],
    groundTruthSource: 'bls_generic',
    groundTruthProvenance:
      'BLS 4.0 2025 DE, sourceId G561100 ("Tomate roh"), reproduced 2026-07-19.',
    referenceNutrients: { kcal: 22, protein_g: 0.95, fat_g: 0.11, carbs_g: 3.25 },
    expectedBehavior: 'direct_resolution',
    criticalFailureConditions: [
      'Auflösung auf ein zusammengesetztes Gericht (z. B. Tomate-Mozzarella) statt der rohen Tomate',
    ],
    reproducibilityNotes:
      'Reproduced 2026-07-19: an evidence-based, currently-unfixed defect -- the resolver actually ' +
      'selects "Tomate-Mozzarella (Caprese)" (X208312, 185 kcal, a composite dish) as its top ' +
      'candidate, with status="ambiguous". Not a benchmark artifact: the raw tomato (G561100) is ' +
      'also present in the candidate set but loses to the composite dish under the current ' +
      'ScoreCalculator weighting. Documented here, not fixed (task scope forbids resolver changes).',
    personalDataFree: true,
    tags: ['bls-generic', 'known-defect', 'wrong-identification'],
  },
  {
    caseId: 'RV3-0010',
    corpusVersion: '1.0.0',
    category: 'SIMPLE',
    difficulty: 'medium',
    rawInput: 'Gurke',
    locale: 'de',
    expectedComponents: [
      {
        componentId: 'c1',
        expectedName: 'Gurke roh',
        expectedQuantity: { value: 100, unit: 'g' },
        required: true,
        expectedSourceId: 'G520100',
        expectedSourceType: 'bls',
      },
    ],
    groundTruthSource: 'bls_generic',
    groundTruthProvenance:
      'BLS 4.0 2025 DE, sourceId G520100 ("Gurke roh"), reproduced 2026-07-19.',
    referenceNutrients: { kcal: 16, protein_g: 1.062, fat_g: 0.2, carbs_g: 1.97 },
    expectedBehavior: 'direct_resolution',
    criticalFailureConditions: [
      'Auflösung auf ein Gurkenderivat (z. B. Gemüsesaft aus Gurke) statt der rohen Gurke',
    ],
    reproducibilityNotes:
      'Reproduced 2026-07-19: another evidence-based, currently-unfixed defect -- the resolver ' +
      'selects "Gemüsesaft aus Gurke" (G520600, 12 kcal, a derived juice product) as its top ' +
      'candidate, status="ambiguous". The raw cucumber (G520100) is present but loses under the ' +
      'current ScoreCalculator weighting. Documented here, not fixed.',
    personalDataFree: true,
    tags: ['bls-generic', 'known-defect', 'wrong-identification'],
  },
  {
    caseId: 'RV3-0011',
    corpusVersion: '1.0.0',
    category: 'DACH',
    difficulty: 'medium',
    rawInput: 'Brötchen',
    locale: 'de',
    regionalContext: 'DE',
    expectedComponents: [
      {
        componentId: 'c1',
        expectedName: 'Weizenbrötchen',
        expectedQuantity: { value: 1, unit: 'piece' },
        required: true,
        expectedSourceId: 'B511000',
        expectedSourceType: 'bls',
      },
    ],
    groundTruthSource: 'bls_generic',
    groundTruthProvenance:
      'BLS 4.0 2025 DE, sourceId B511000 ("Weizenbrötchen", the plain wheat bread roll), located ' +
      'directly in the committed artifact bls-runtime-compact.v1.json on 2026-07-19 (82 ' +
      '"Brötchen"-containing records exist; B511000 is the plain generic one).',
    referenceNutrients: { kcal: 280, protein_g: 10.09, fat_g: 1.81, carbs_g: 53.97 },
    expectedBehavior: 'direct_resolution',
    criticalFailureConditions: [
      'Bare "Brötchen" darf nicht scheinsicher auf eine Spezialvariante (z. B. Blätterteig-Brötchen) fixiert werden',
    ],
    reproducibilityNotes:
      'Reproduced 2026-07-19: a real, reproducible **false-confident** case -- the resolver ' +
      'returns status="accepted" (only one candidate survives the resolver\'s own filtering/' +
      'scoring for the normalized query "broetchen") with best="Brötchen (Blätterteig)" (D771900, ' +
      '425 kcal, a puff-pastry variant), while the plain "Weizenbrötchen" (B511000, 280 kcal) that ' +
      'a DACH speaker means by bare "Brötchen" never enters the surviving candidate set. This is ' +
      "the harness's clearest evidence-based false-confidence finding for Variant A: not fixed here.",
    personalDataFree: true,
    tags: ['dach-regional', 'known-defect', 'false-confidence'],
  },
  {
    caseId: 'RV3-0012',
    corpusVersion: '1.0.0',
    category: 'SIMPLE',
    difficulty: 'medium',
    rawInput: 'Reis',
    locale: 'de',
    expectedComponents: [
      {
        componentId: 'c1',
        expectedName: 'Reis poliert, roh',
        expectedQuantity: { value: 100, unit: 'g' },
        required: true,
        expectedSourceId: 'C352000',
        expectedSourceType: 'bls',
        canonicalEquivalents: ['C359000'],
      },
    ],
    groundTruthSource: 'bls_generic',
    groundTruthProvenance:
      'BLS 4.0 2025 DE. Two legitimate, materially similar generic rice records exist for bare ' +
      '"Reis": C352000 ("Reis poliert, roh", 351 kcal) and C359000 ("Reis parboiled, poliert, ' +
      'roh", 333 kcal) -- both plain milled rice differing only by processing method, unlike the ' +
      'Speck clusters (§RV3-0008) which are materially different foods. Both accepted as ' +
      '`canonicalEquivalents` per spec §2.2/§6.1 rather than treated as a defect.',
    referenceNutrients: { kcal: 351, protein_g: 7.931, fat_g: 0.62, carbs_g: 77.1 },
    expectedBehavior: 'multiple_candidates_acceptable',
    criticalFailureConditions: [
      'Auflösung auf ein völlig anderes Lebensmittel (z. B. Reismehl oder eine Fertigmischung) statt reinem Reis',
    ],
    reproducibilityNotes:
      'Reproduced 2026-07-19: status="ambiguous" (MULTIPLE_CLOSE_MATCHES), best=C359000 ' +
      '(parboiled variant) -- covered by `canonicalEquivalents`, so identification counts as an ' +
      'acceptable equivalence match; the "ambiguous" status is itself the expected behavior here.',
    personalDataFree: true,
    tags: ['bls-generic', 'acceptable-ambiguity'],
  },
  {
    caseId: 'RV3-0013',
    corpusVersion: '1.0.0',
    category: 'DACH',
    difficulty: 'medium',
    rawInput: 'Spätzle',
    locale: 'de',
    regionalContext: 'DE',
    expectedComponents: [
      {
        componentId: 'c1',
        expectedName: 'Eier-Frischteigwaren Spätzle, selbstgemacht, roh',
        expectedQuantity: { value: 100, unit: 'g' },
        required: true,
        expectedSourceId: 'X711512',
        expectedSourceType: 'bls',
      },
    ],
    groundTruthSource: 'bls_generic',
    groundTruthProvenance: 'BLS 4.0 2025 DE, sourceId X711512, reproduced 2026-07-19.',
    referenceNutrients: { kcal: 220, protein_g: 9.3, fat_g: 3.93, carbs_g: 35.54 },
    expectedBehavior: 'direct_resolution',
    criticalFailureConditions: [
      'Auflösung auf eine völlig andere Spätzle-Variante (z. B. Leberspätzle) statt der einfachen Eiernudeln',
    ],
    reproducibilityNotes:
      'Reproduced 2026-07-19: the plain egg-noodle Spätzle (X711512) IS the top-ranked candidate, ' +
      'but overall status="ambiguous" (tied ScoreCalculator scores among the 3 BLS candidates) -- ' +
      'the same "correct top-1, unnecessary ambiguity flag" pattern as RV3-0007 (Himbeeren).',
    personalDataFree: true,
    tags: ['dach-regional', 'ambiguous-status-quirk'],
  },
  {
    caseId: 'RV3-0014',
    corpusVersion: '1.0.0',
    category: 'DACH',
    subcategory: 'Zwiebelrostbraten mit Spätzle',
    difficulty: 'hard',
    rawInput: 'Zwiebelrostbraten',
    locale: 'de',
    regionalContext: 'DE',
    expectedComponents: [],
    groundTruthSource: 'no_numeric_ground_truth',
    groundTruthProvenance: undefined,
    referenceNutrients: null,
    expectedBehavior: 'abstention_expected',
    criticalFailureConditions: [
      'Scheinpräziser kcal-Wert für ein komplexes DACH-Regionalgericht ohne dokumentierte Rezept-/Mengenherleitung',
      'Regionalfehlzuordnung auf ein nicht-deutsches Gericht gleichen/ähnlichen Namens',
    ],
    reproducibilityNotes:
      'Reproduced 2026-07-19: status="rejected" (NO_CANDIDATES) -- BLS has no entry for this ' +
      'compound DACH dish name, so the resolver honestly returns no result rather than a ' +
      "fabricated number. Per ROADMAP.md's explicit RESOLVER-V3-003 instruction, this case is " +
      'kept non-numeric (no binding recipe-derived ground truth exists in this repository yet) ' +
      'instead of reusing the Amy-reported ~60% overestimation figure from ' +
      'docs/domains/ZERA_FOOD_RESOLUTION_DECISION_RECORD_1.md §2.1, which is explicitly forbidden ' +
      'as a Zera ground-truth source (spec §5 "Amy-Ergebnisse sind niemals Ground Truth").',
    personalDataFree: true,
    tags: ['dach-regional', 'amy-motivated', 'honest-abstention', 'no-ground-truth'],
    notes:
      'Motivated by (but does not reuse the numeric value of) the Amy "Zwiebelrostbraten" report ' +
      'in the Decision Record §2.1 -- see spec §2.4 Example 2 for the fuller illustrative ' +
      '(non-committed) COMPOSED version of this dish with recipe-level component breakdown, which ' +
      'remains out of scope here because it would require multi-component decomposition above the ' +
      "resolver boundary (see RV3-0005's notes).",
  },
];
