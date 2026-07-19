/**
 * RESOLVER-V3-004: deterministic, recorded/synthetic Variant B fixture responses, keyed by the
 * RESOLVER-V3-001/V3-003 committed corpus's `caseId` (`resolverV3VariantASmokeCorpus.ts`).
 *
 * These are hand-authored, NOT real provider output -- clearly labeled as such everywhere they
 * are used (`FixtureVariantBProvider`, the fixture-mode report banner). Their purpose is to
 * exercise the full harness pipeline (parsing, validation, normalization, evaluation,
 * aggregation, reporting) deterministically without network access or cost, per ROADMAP.md's
 * "keine Netzwerkoperation im Fixture-Modus" / "Fixture-/Testreports duerfen nicht als reale
 * Qualitaetsmessung praesentiert werden" requirements -- NOT to make any claim about what a real
 * AI provider would actually say for these inputs.
 *
 * Deliberately mixed quality, matching this task's instruction not to curate only wins: most
 * cases are plausible/correct estimates (to exercise the "good" pipeline path realistically), one
 * (RV3-0009, "Tomate") is a deliberately wrong-but-confident estimate to exercise false-confidence
 * detection, RV3-0008 ("Speck") exercises `clarification_required`, and RV3-0014
 * ("Zwiebelrostbraten") exercises `abstained`. No ground-truth numeric value from the corpus is
 * copied verbatim into a fixture where the fixture is supposed to represent an *independent*
 * estimate -- values are independently plausible approximations, per-100g-normalizable by
 * design so the macro-comparison pipeline has real samples to score in fixture mode too.
 */

function json(value: unknown): string {
  return JSON.stringify(value);
}

export const VARIANT_B_FIXTURE_RESPONSES: Readonly<Record<string, string>> = {
  'RV3-0001': json({
    outcome: 'estimated',
    components: [
      {
        componentId: 'c1',
        name: 'Magerquark (Speisequark Magerstufe)',
        quantity: { value: 200, unit: 'g' },
        kcal: 132,
        protein_g: 23.7,
        fat_g: 0.36,
        carbs_g: 7.36,
        assumptions: ['Menge von 200 g angenommen, da nicht angegeben'],
        uncertainties: [],
        confidence: 0.8,
      },
    ],
    totals: { kcal: 132, protein_g: 23.7, fat_g: 0.36, carbs_g: 7.36 },
    overallConfidence: 0.8,
    assumptions: ['Menge von 200 g angenommen, da nicht angegeben'],
    uncertainties: [],
    clarification: null,
    reason: null,
  }),

  'RV3-0002': json({
    outcome: 'estimated',
    components: [
      {
        componentId: 'c1',
        name: 'Magerquark',
        quantity: { value: 200, unit: 'g' },
        kcal: 132,
        protein_g: 23.7,
        fat_g: 0.36,
        carbs_g: 7.36,
        assumptions: ['Menge von 200 g angenommen, da nicht angegeben'],
        uncertainties: [],
        confidence: 0.82,
      },
    ],
    totals: { kcal: 132, protein_g: 23.7, fat_g: 0.36, carbs_g: 7.36 },
    overallConfidence: 0.82,
    assumptions: ['Menge von 200 g angenommen, da nicht angegeben'],
    uncertainties: [],
    clarification: null,
    reason: null,
  }),

  'RV3-0003': json({
    outcome: 'estimated',
    components: [
      {
        componentId: 'c1',
        name: 'Huehnerei',
        quantity: { value: 1, unit: 'piece', householdMeasure: '1 Ei' },
        kcal: 78,
        protein_g: 6.8,
        fat_g: 5.5,
        carbs_g: 0.6,
        assumptions: ['Standardgroesse M je Ei angenommen'],
        uncertainties: [],
        confidence: 0.7,
      },
    ],
    totals: { kcal: 78, protein_g: 6.8, fat_g: 5.5, carbs_g: 0.6 },
    overallConfidence: 0.7,
    assumptions: ['Standardgroesse M je Ei angenommen'],
    uncertainties: [],
    clarification: null,
    reason: null,
  }),

  'RV3-0004': json({
    outcome: 'estimated',
    components: [
      {
        componentId: 'c1',
        name: 'Huehnerei',
        quantity: { value: 3, unit: 'piece', householdMeasure: '3 Eier' },
        kcal: 234,
        protein_g: 20.4,
        fat_g: 16.5,
        carbs_g: 1.8,
        assumptions: ['Standardgroesse M je Ei angenommen'],
        uncertainties: [],
        confidence: 0.7,
      },
    ],
    totals: { kcal: 234, protein_g: 20.4, fat_g: 16.5, carbs_g: 1.8 },
    overallConfidence: 0.7,
    assumptions: ['Standardgroesse M je Ei angenommen'],
    uncertainties: [],
    clarification: null,
    reason: null,
  }),

  'RV3-0005': json({
    outcome: 'estimated',
    components: [
      {
        componentId: 'c1',
        name: 'Toast',
        quantity: { value: 70, unit: 'g', householdMeasure: '2 Scheiben (ca. 70 g)' },
        kcal: 180,
        protein_g: 5.9,
        fat_g: 2.5,
        carbs_g: 32,
        assumptions: ['Gewicht von 2 Scheiben Toastbrot auf ca. 70 g geschaetzt'],
        uncertainties: [],
        confidence: 0.65,
      },
    ],
    totals: { kcal: 180, protein_g: 5.9, fat_g: 2.5, carbs_g: 32 },
    overallConfidence: 0.65,
    assumptions: ['Gewicht von 2 Scheiben Toastbrot auf ca. 70 g geschaetzt'],
    uncertainties: [],
    clarification: null,
    reason: null,
  }),

  'RV3-0006': json({
    outcome: 'estimated',
    components: [
      {
        componentId: 'c1',
        name: 'Haferflocken',
        quantity: { value: 50, unit: 'g' },
        kcal: 174,
        protein_g: 6.61,
        fat_g: 3.325,
        carbs_g: 26.65,
        assumptions: ['Menge von 50 g angenommen, da nicht angegeben'],
        uncertainties: [],
        confidence: 0.75,
      },
    ],
    totals: { kcal: 174, protein_g: 6.61, fat_g: 3.325, carbs_g: 26.65 },
    overallConfidence: 0.75,
    assumptions: ['Menge von 50 g angenommen, da nicht angegeben'],
    uncertainties: [],
    clarification: null,
    reason: null,
  }),

  'RV3-0007': json({
    outcome: 'estimated',
    components: [
      {
        componentId: 'c1',
        name: 'Himbeere',
        quantity: { value: 100, unit: 'g' },
        kcal: 43,
        protein_g: 1,
        fat_g: 0.3,
        carbs_g: 5.2,
        assumptions: ['Menge von 100 g angenommen, da nicht angegeben'],
        uncertainties: [],
        confidence: 0.85,
      },
    ],
    totals: { kcal: 43, protein_g: 1, fat_g: 0.3, carbs_g: 5.2 },
    overallConfidence: 0.85,
    assumptions: ['Menge von 100 g angenommen, da nicht angegeben'],
    uncertainties: [],
    clarification: null,
    reason: null,
  }),

  'RV3-0008': json({
    outcome: 'clarification_required',
    components: [],
    totals: null,
    overallConfidence: null,
    assumptions: [],
    uncertainties: [
      'Naehrwert von Speck haengt stark von der Sorte ab (Bacon vs. Rueckenspeck vs. Schinkenspeck)',
    ],
    clarification: {
      componentId: null,
      missingInformation:
        'Welche Art Speck ist gemeint (Bauchspeck/Bacon, Rueckenspeck/Fettspeck oder magerer Schinkenspeck)?',
      clarificationKind: 'ambiguous_food_identity',
    },
    reason: null,
  }),

  // Deliberately wrong-but-confident: exercises false-confidence detection (this is a hand-
  // authored fixture crafted for that purpose, NOT a claim about real provider behavior).
  'RV3-0009': json({
    outcome: 'estimated',
    components: [
      {
        componentId: 'c1',
        name: 'Tomate mit Mozzarella',
        quantity: { value: 150, unit: 'g' },
        kcal: 277.5,
        protein_g: 15,
        fat_g: 20,
        carbs_g: 6,
        assumptions: ['Nutzer meint vermutlich eine Caprese-aehnliche Zubereitung'],
        uncertainties: [],
        confidence: 0.82,
      },
    ],
    totals: { kcal: 277.5, protein_g: 15, fat_g: 20, carbs_g: 6 },
    overallConfidence: 0.82,
    assumptions: ['Nutzer meint vermutlich eine Caprese-aehnliche Zubereitung'],
    uncertainties: [],
    clarification: null,
    reason: null,
  }),

  'RV3-0010': json({
    outcome: 'estimated',
    components: [
      {
        componentId: 'c1',
        name: 'Gurke',
        quantity: { value: 100, unit: 'g' },
        kcal: 16,
        protein_g: 1.06,
        fat_g: 0.2,
        carbs_g: 1.97,
        assumptions: ['Menge von 100 g angenommen, da nicht angegeben'],
        uncertainties: [],
        confidence: 0.75,
      },
    ],
    totals: { kcal: 16, protein_g: 1.06, fat_g: 0.2, carbs_g: 1.97 },
    overallConfidence: 0.75,
    assumptions: ['Menge von 100 g angenommen, da nicht angegeben'],
    uncertainties: [],
    clarification: null,
    reason: null,
  }),

  'RV3-0011': json({
    outcome: 'estimated',
    components: [
      {
        componentId: 'c1',
        name: 'Brötchen',
        quantity: { value: 50, unit: 'g', householdMeasure: '1 Broetchen (~50 g)' },
        kcal: 140,
        protein_g: 5.05,
        fat_g: 0.9,
        carbs_g: 27,
        assumptions: ['Standardgewicht 50 g fuer ein einfaches Weizenbroetchen angenommen'],
        uncertainties: [],
        confidence: 0.7,
      },
    ],
    totals: { kcal: 140, protein_g: 5.05, fat_g: 0.9, carbs_g: 27 },
    overallConfidence: 0.7,
    assumptions: ['Standardgewicht 50 g fuer ein einfaches Weizenbroetchen angenommen'],
    uncertainties: [],
    clarification: null,
    reason: null,
  }),

  'RV3-0012': json({
    outcome: 'estimated',
    components: [
      {
        componentId: 'c1',
        name: 'Reis (roh)',
        quantity: { value: 100, unit: 'g' },
        kcal: 351,
        protein_g: 7.93,
        fat_g: 0.62,
        carbs_g: 77.1,
        assumptions: ['Menge von 100 g roh angenommen, da nicht angegeben'],
        uncertainties: [],
        confidence: 0.75,
      },
    ],
    totals: { kcal: 351, protein_g: 7.93, fat_g: 0.62, carbs_g: 77.1 },
    overallConfidence: 0.75,
    assumptions: ['Menge von 100 g roh angenommen, da nicht angegeben'],
    uncertainties: [],
    clarification: null,
    reason: null,
  }),

  'RV3-0013': json({
    outcome: 'estimated',
    components: [
      {
        componentId: 'c1',
        name: 'Spätzle',
        quantity: { value: 100, unit: 'g' },
        kcal: 220,
        protein_g: 9.3,
        fat_g: 3.93,
        carbs_g: 35.54,
        assumptions: ['Menge von 100 g roh angenommen, da nicht angegeben'],
        uncertainties: [],
        confidence: 0.7,
      },
    ],
    totals: { kcal: 220, protein_g: 9.3, fat_g: 3.93, carbs_g: 35.54 },
    overallConfidence: 0.7,
    assumptions: ['Menge von 100 g roh angenommen, da nicht angegeben'],
    uncertainties: [],
    clarification: null,
    reason: null,
  }),

  'RV3-0014': json({
    outcome: 'abstained',
    components: [],
    totals: null,
    overallConfidence: null,
    assumptions: [],
    uncertainties: ['Keine verlaessliche Standardrezeptur ohne weitere Angaben zu Zutaten/Mengen'],
    clarification: null,
    reason:
      'Zwiebelrostbraten ist ein komplexes Rezeptgericht ohne verlaessliche Standardrezeptur -- ' +
      'eine Zahl ohne dokumentierte Zutaten-/Mengenherleitung waere unbelegt.',
  }),
};
