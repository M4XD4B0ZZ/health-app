// Fixed evaluation set for the AI re-ranking benchmark (RESOLVER-V2-007-B).
// Scenarios are grounded in this repo's actual DACH ambiguity cases (see
// ROADMAP.md's DACH Data Strategy, src/features/nutrition/domain/catalog/FoodAliasDictionary.ts,
// and SequentialFoodCatalogResolver.test.ts) rather than invented examples -- these are the
// kinds of low-confidence, multi-candidate situations RESOLVER-V2-007 is meant to help with.
//
// Each case's `expectedWinnerId` is a human judgement call (which candidate a native
// DACH speaker would mean), not ground truth from a dataset -- treat accuracy against
// this fixture set as a useful relative signal between providers, not an absolute quality
// score for real users.

export const BENCHMARK_CASES = [
  {
    id: 'quark-vs-schmand',
    query: 'quark',
    locale: 'de',
    candidates: [
      { id: 'bls-magerquark', source: 'BLS', name: 'Magerquark', score: 0.58 },
      { id: 'off-schmand', source: 'OFF', name: 'Schmand 24% Fett', score: 0.51 },
      { id: 'usda-curd', source: 'USDA', name: 'Curd, cheese, uncreamed', score: 0.49 },
    ],
    expectedWinnerId: 'bls-magerquark',
    note: 'quark/schmand/curd are the canonical DACH generic-food ambiguity case in ROADMAP.md',
  },
  {
    id: 'ei-vs-eier-plural',
    query: 'eier',
    locale: 'de',
    candidates: [
      { id: 'bls-ei-huhn', source: 'BLS', name: 'Hühnerei, gekocht', score: 0.55 },
      { id: 'off-eierlikoer', source: 'OFF', name: 'Eierlikör', score: 0.52 },
    ],
    expectedWinnerId: 'bls-ei-huhn',
    note: 'plural "eier" should not be pulled toward an unrelated branded product sharing the substring',
  },
  {
    id: 'branded-vs-generic-carrot',
    query: 'karotten',
    locale: 'de',
    candidates: [
      {
        id: 'off-carrot-bread',
        source: 'OFF',
        name: 'Das Pure - Bio-Haferbrot Karotten & Walnüsse',
        score: 0.45,
      },
      { id: 'usda-carrots-raw', source: 'USDA', name: 'Carrots, raw', score: 0.53 },
    ],
    expectedWinnerId: 'usda-carrots-raw',
    note: 'generic input should not resolve to a composite branded product that merely contains the word',
  },
  {
    id: 'haehnchen-de-en-mapping',
    query: 'hähnchenbrust',
    locale: 'de',
    candidates: [
      { id: 'usda-chicken-breast', source: 'USDA', name: 'Chicken, breast, roasted', score: 0.6 },
      {
        id: 'off-haehnchen-nuggets',
        source: 'OFF',
        name: 'Hähnchen Nuggets, paniert',
        score: 0.44,
      },
    ],
    expectedWinnerId: 'usda-chicken-breast',
    note: 'plain cut vs. a processed/breaded branded product with a partial name match',
  },
  {
    id: 'joghurt-natural-vs-flavored',
    query: 'joghurt',
    locale: 'de',
    candidates: [
      { id: 'bls-joghurt-natur', source: 'BLS', name: 'Joghurt, natur, 3.5% Fett', score: 0.5 },
      { id: 'off-joghurt-erdbeer', source: 'OFF', name: 'Fruchtjoghurt Erdbeere', score: 0.48 },
      { id: 'off-joghurtdrink', source: 'OFF', name: 'Trinkjoghurt Mango-Maracuja', score: 0.42 },
    ],
    expectedWinnerId: 'bls-joghurt-natur',
    note: 'unqualified "joghurt" should default to the plain/natural variant, not a flavored branded one',
  },
  {
    id: 'brot-generic-vs-branded-composite',
    query: 'brot',
    locale: 'de',
    candidates: [
      { id: 'bls-mischbrot', source: 'BLS', name: 'Mischbrot', score: 0.47 },
      {
        id: 'off-brot-nuss',
        source: 'OFF',
        name: 'Vollkornbrot mit Walnüssen und Sonnenblumenkernen',
        score: 0.46,
      },
    ],
    expectedWinnerId: 'bls-mischbrot',
    note: 'close scores -- tests whether the provider over-indexes on a longer, more specific-looking name',
  },
  {
    id: 'apfel-fruit-vs-juice',
    query: 'apfel',
    locale: 'de',
    candidates: [
      { id: 'usda-apple-raw', source: 'USDA', name: 'Apples, raw, with skin', score: 0.56 },
      { id: 'off-apfelsaft', source: 'OFF', name: 'Apfelsaft, klar, 100%', score: 0.5 },
    ],
    expectedWinnerId: 'usda-apple-raw',
    note: 'the whole fruit should win over a derived product for the unqualified fruit name',
  },
  {
    id: 'kaese-generic-vs-processed',
    query: 'käse',
    locale: 'de',
    candidates: [
      { id: 'bls-gouda', source: 'BLS', name: 'Gouda, 45% Fett i. Tr.', score: 0.44 },
      {
        id: 'off-schmelzkaese',
        source: 'OFF',
        name: 'Schmelzkäsezubereitung, Scheiben',
        score: 0.43,
      },
    ],
    expectedWinnerId: 'bls-gouda',
    note: 'very close scores -- a real low-confidence resolver case where re-ranking is meant to help',
  },
];
