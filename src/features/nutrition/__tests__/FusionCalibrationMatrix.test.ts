import { FusionCandidateResolver } from '../application/services/FusionCandidateResolver';
import { FoodCatalogSource, FoodSearchQuery } from '../domain/catalog/FoodCatalogSource';

const TEST_CASES = [
  "quark",
  "magerquark",
  "frischkäse",
  "ei",
  "eier",
  "rührei",
  "toast",
  "buttertoast",
  "protein quark",
  "greek yogurt",
  "cottage cheese",
  "curd",
  "schinken",
  "hähnchen",
  "milch"
];

// Global storage for integrity checks
const globalResults: Record<string, { top3Names: string[]; winnerName: string }> = {};

// Mock sources with COMPLETE input-dependent candidates
const mockBlsSource: FoodCatalogSource = {
  type: 'bls',
  search: jest.fn().mockImplementation((query: FoodSearchQuery) => {
    const input = query.normalized;
    
    // Input-specific BLS candidates - COMPLETE coverage for all TEST_CASES
    const blsCandidates: Record<string, any[]> = {
      'quark': [
        {
          food: {
            id: 'bls-quark-1',
            name: 'Speisequark Magerstufe',
            normalizedName: 'quark',
            macrosPer100g: { kcal: 66, protein: 11.85, carbs: 3.68, fat: 0.18 },
            source: 'bls' as const,
            sourceId: 'M713100'
          },
          match: { exact: true, similarity: 1.0, usedHeuristic: undefined },
          confidence: 1.0,
          reasons: ['Exact BLS match']
        }
      ],
      'magerquark': [
        {
          food: {
            id: 'bls-magerquark-1',
            name: 'Speisequark Magerstufe, Magerquark < 10 % Fett i. Tr.',
            normalizedName: 'magerquark',
            macrosPer100g: { kcal: 66, protein: 11.85, carbs: 3.68, fat: 0.18 },
            source: 'bls' as const,
            sourceId: 'M713100'
          },
          match: { exact: true, similarity: 1.0, usedHeuristic: undefined },
          confidence: 1.0,
          reasons: ['Exact BLS match']
        }
      ],
      'frischkäse': [
        {
          food: {
            id: 'bls-frischkaese-1',
            name: 'Frischkäse, Doppelrahmstufe',
            normalizedName: 'frischkäse',
            macrosPer100g: { kcal: 206, protein: 11, carbs: 2.7, fat: 17 },
            source: 'bls' as const,
            sourceId: 'M714100'
          },
          match: { exact: true, similarity: 1.0, usedHeuristic: undefined },
          confidence: 1.0,
          reasons: ['Exact BLS match']
        }
      ],
      'ei': [
        {
          food: {
            id: 'bls-ei-1',
            name: 'Hühnerei, ganz',
            normalizedName: 'ei',
            macrosPer100g: { kcal: 155, protein: 13, carbs: 1.1, fat: 11 },
            source: 'bls' as const,
            sourceId: 'L111100'
          },
          match: { exact: true, similarity: 1.0, usedHeuristic: undefined },
          confidence: 1.0,
          reasons: ['Exact BLS match']
        }
      ],
      'eier': [
        {
          food: {
            id: 'bls-eier-1',
            name: 'Hühnerei, ganz',
            normalizedName: 'eier',
            macrosPer100g: { kcal: 155, protein: 13, carbs: 1.1, fat: 11 },
            source: 'bls' as const,
            sourceId: 'L111100'
          },
          match: { exact: false, similarity: 0.95, usedHeuristic: 'alias' },
          confidence: 0.95,
          reasons: ['BLS alias match (eier -> ei)']
        }
      ],
      'rührei': [
        {
          food: {
            id: 'bls-ruehrei-1',
            name: 'Rührei',
            normalizedName: 'rührei',
            macrosPer100g: { kcal: 154, protein: 10.5, carbs: 1.4, fat: 11.2 },
            source: 'bls' as const,
            sourceId: 'L111300'
          },
          match: { exact: true, similarity: 1.0, usedHeuristic: undefined },
          confidence: 1.0,
          reasons: ['Exact BLS match']
        }
      ],
      'toast': [
        {
          food: {
            id: 'bls-toast-1',
            name: 'Toastbrot',
            normalizedName: 'toast',
            macrosPer100g: { kcal: 259, protein: 8.4, carbs: 49, fat: 3.2 },
            source: 'bls' as const,
            sourceId: 'G111200'
          },
          match: { exact: true, similarity: 1.0, usedHeuristic: undefined },
          confidence: 1.0,
          reasons: ['Exact BLS match']
        }
      ],
      'buttertoast': [
        {
          food: {
            id: 'bls-buttertoast-1',
            name: 'Toastbrot mit Butter',
            normalizedName: 'buttertoast',
            macrosPer100g: { kcal: 312, protein: 7.8, carbs: 45, fat: 11.2 },
            source: 'bls' as const,
            sourceId: 'G111201'
          },
          match: { exact: true, similarity: 1.0, usedHeuristic: undefined },
          confidence: 1.0,
          reasons: ['Exact BLS match']
        }
      ],
      'protein quark': [
        {
          food: {
            id: 'bls-protein-quark-1',
            name: 'Speisequark mit Protein-Zusatz',
            normalizedName: 'protein quark',
            macrosPer100g: { kcal: 85, protein: 15, carbs: 3.2, fat: 0.2 },
            source: 'bls' as const,
            sourceId: 'M713200'
          },
          match: { exact: false, similarity: 0.9, usedHeuristic: 'fuzzy' },
          confidence: 0.9,
          reasons: ['BLS fuzzy match for protein quark']
        }
      ],
      'greek yogurt': [
        {
          food: {
            id: 'bls-greek-yogurt-1',
            name: 'Joghurt, griechischer Art',
            normalizedName: 'greek yogurt',
            macrosPer100g: { kcal: 133, protein: 9, carbs: 4, fat: 10 },
            source: 'bls' as const,
            sourceId: 'M712300'
          },
          match: { exact: false, similarity: 0.8, usedHeuristic: 'translation' },
          confidence: 0.8,
          reasons: ['BLS translation match (greek yogurt -> griechischer joghurt)']
        }
      ],
      'cottage cheese': [
        {
          food: {
            id: 'bls-cottage-cheese-1',
            name: 'Körniger Frischkäse',
            normalizedName: 'cottage cheese',
            macrosPer100g: { kcal: 102, protein: 12.5, carbs: 3.5, fat: 4.3 },
            source: 'bls' as const,
            sourceId: 'M714200'
          },
          match: { exact: false, similarity: 0.85, usedHeuristic: 'translation' },
          confidence: 0.85,
          reasons: ['BLS translation match (cottage cheese -> körniger frischkäse)']
        }
      ],
      'curd': [
        {
          food: {
            id: 'bls-curd-1',
            name: 'Dickmilch, Sauermilch',
            normalizedName: 'curd',
            macrosPer100g: { kcal: 62, protein: 3.4, carbs: 4.1, fat: 3.5 },
            source: 'bls' as const,
            sourceId: 'M711200'
          },
          match: { exact: false, similarity: 0.7, usedHeuristic: 'alias' },
          confidence: 0.7,
          reasons: ['BLS alias match for curd']
        }
      ],
      'schinken': [
        {
          food: {
            id: 'bls-schinken-1',
            name: 'Schinken, gekocht',
            normalizedName: 'schinken',
            macrosPer100g: { kcal: 125, protein: 22.5, carbs: 0.5, fat: 3.2 },
            source: 'bls' as const,
            sourceId: 'F211100'
          },
          match: { exact: true, similarity: 1.0, usedHeuristic: undefined },
          confidence: 1.0,
          reasons: ['Exact BLS match']
        }
      ],
      'hähnchen': [
        {
          food: {
            id: 'bls-haehnchen-1',
            name: 'Hähnchen, Brustfilet, ohne Haut',
            normalizedName: 'hähnchen',
            macrosPer100g: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
            source: 'bls' as const,
            sourceId: 'F312100'
          },
          match: { exact: true, similarity: 1.0, usedHeuristic: undefined },
          confidence: 1.0,
          reasons: ['Exact BLS match']
        }
      ],
      'milch': [
        {
          food: {
            id: 'bls-milch-1',
            name: 'Milch, 3,5% Fett',
            normalizedName: 'milch',
            macrosPer100g: { kcal: 64, protein: 3.3, carbs: 4.8, fat: 3.5 },
            source: 'bls' as const,
            sourceId: 'M111100'
          },
          match: { exact: true, similarity: 1.0, usedHeuristic: undefined },
          confidence: 1.0,
          reasons: ['Exact BLS match']
        }
      ]
    };
    
    const candidates = blsCandidates[input] || [];
    console.log(`SOURCE_RAW_CANDIDATES input="${input}" source="bls" names=[${candidates.map(c => `"${c.food.name}"`).join(', ')}]`);
    return Promise.resolve(candidates);
  })
};

const mockOffSource: FoodCatalogSource = {
  type: 'off',
  search: jest.fn().mockImplementation((query: FoodSearchQuery) => {
    const input = query.normalized;
    
    // Input-specific OFF candidates - COMPLETE coverage for all TEST_CASES
    const offCandidates: Record<string, any[]> = {
      'quark': [
        {
          food: {
            id: 'off-quark-1',
            name: 'High Protein Quark',
            normalizedName: 'quark',
            macrosPer100g: { kcal: 95, protein: 12, carbs: 4, fat: 0.2 },
            source: 'off' as const,
            sourceId: 'off-quark-1'
          },
          match: { exact: false, similarity: 0.85, usedHeuristic: 'fuzzy' },
          confidence: 0.85,
          reasons: ['OFF branded quark match']
        }
      ],
      'magerquark': [
        {
          food: {
            id: 'off-magerquark-1',
            name: 'Skyr Magerquark 0% Fett',
            normalizedName: 'magerquark',
            macrosPer100g: { kcal: 62, protein: 11, carbs: 4, fat: 0.2 },
            source: 'off' as const,
            sourceId: 'off-magerquark-1'
          },
          match: { exact: true, similarity: 1.0, usedHeuristic: undefined },
          confidence: 1.0,
          reasons: ['OFF exact magerquark match']
        }
      ],
      'frischkäse': [
        {
          food: {
            id: 'off-frischkaese-1',
            name: 'Philadelphia Frischkäse Original',
            normalizedName: 'frischkäse',
            macrosPer100g: { kcal: 255, protein: 5.6, carbs: 3.2, fat: 24 },
            source: 'off' as const,
            sourceId: 'off-frischkaese-1'
          },
          match: { exact: true, similarity: 1.0, usedHeuristic: undefined },
          confidence: 1.0,
          reasons: ['OFF exact frischkäse match']
        }
      ],
      'ei': [
        {
          food: {
            id: 'off-ei-1',
            name: 'Bio Eier Freilandhaltung',
            normalizedName: 'ei',
            macrosPer100g: { kcal: 150, protein: 12.8, carbs: 0.7, fat: 10.5 },
            source: 'off' as const,
            sourceId: 'off-ei-1'
          },
          match: { exact: true, similarity: 1.0, usedHeuristic: undefined },
          confidence: 1.0,
          reasons: ['OFF exact ei match']
        }
      ],
      'eier': [
        {
          food: {
            id: 'off-eier-1',
            name: 'Bio Eier Freilandhaltung 6er Pack',
            normalizedName: 'eier',
            macrosPer100g: { kcal: 150, protein: 12.8, carbs: 0.7, fat: 10.5 },
            source: 'off' as const,
            sourceId: 'off-eier-1'
          },
          match: { exact: true, similarity: 1.0, usedHeuristic: undefined },
          confidence: 1.0,
          reasons: ['OFF exact eier match']
        }
      ],
      'rührei': [
        {
          food: {
            id: 'off-ruehrei-1',
            name: 'Fertig Rührei mit Kräutern',
            normalizedName: 'rührei',
            macrosPer100g: { kcal: 165, protein: 9.8, carbs: 2.1, fat: 12.5 },
            source: 'off' as const,
            sourceId: 'off-ruehrei-1'
          },
          match: { exact: true, similarity: 1.0, usedHeuristic: undefined },
          confidence: 1.0,
          reasons: ['OFF exact rührei match']
        }
      ],
      'toast': [
        {
          food: {
            id: 'off-toast-1',
            name: 'Golden Toast Buttertoast',
            normalizedName: 'toast',
            macrosPer100g: { kcal: 265, protein: 8.5, carbs: 48, fat: 4.2 },
            source: 'off' as const,
            sourceId: 'off-toast-1'
          },
          match: { exact: false, similarity: 0.9, usedHeuristic: undefined },
          confidence: 0.9,
          reasons: ['OFF branded toast match']
        }
      ],
      'buttertoast': [
        {
          food: {
            id: 'off-buttertoast-1',
            name: 'Golden Toast Buttertoast',
            normalizedName: 'buttertoast',
            macrosPer100g: { kcal: 265, protein: 8.5, carbs: 48, fat: 4.2 },
            source: 'off' as const,
            sourceId: 'off-buttertoast-1'
          },
          match: { exact: true, similarity: 1.0, usedHeuristic: undefined },
          confidence: 1.0,
          reasons: ['OFF exact branded match']
        }
      ],
      'protein quark': [
        {
          food: {
            id: 'off-protein-quark-1',
            name: 'Ehrmann High Protein Quark',
            normalizedName: 'protein quark',
            macrosPer100g: { kcal: 95, protein: 15, carbs: 4, fat: 0.2 },
            source: 'off' as const,
            sourceId: 'off-protein-quark-1'
          },
          match: { exact: true, similarity: 1.0, usedHeuristic: undefined },
          confidence: 1.0,
          reasons: ['OFF exact protein quark match']
        }
      ],
      'greek yogurt': [
        {
          food: {
            id: 'off-greek-yogurt-1',
            name: 'Fage Total Greek Yogurt 0%',
            normalizedName: 'greek yogurt',
            macrosPer100g: { kcal: 57, protein: 10, carbs: 4, fat: 0 },
            source: 'off' as const,
            sourceId: 'off-greek-yogurt-1'
          },
          match: { exact: true, similarity: 1.0, usedHeuristic: undefined },
          confidence: 1.0,
          reasons: ['OFF exact greek yogurt match']
        }
      ],
      'cottage cheese': [
        {
          food: {
            id: 'off-cottage-cheese-1',
            name: 'Arla Körniger Frischkäse',
            normalizedName: 'cottage cheese',
            macrosPer100g: { kcal: 102, protein: 12.5, carbs: 3.5, fat: 4.3 },
            source: 'off' as const,
            sourceId: 'off-cottage-cheese-1'
          },
          match: { exact: false, similarity: 0.9, usedHeuristic: 'translation' },
          confidence: 0.9,
          reasons: ['OFF translation match (cottage cheese -> körniger frischkäse)']
        }
      ],
      'curd': [
        {
          food: {
            id: 'off-curd-1',
            name: 'Körniger Frischkäse light',
            normalizedName: 'curd',
            macrosPer100g: { kcal: 85, protein: 13, carbs: 3, fat: 2.5 },
            source: 'off' as const,
            sourceId: 'off-curd-1'
          },
          match: { exact: false, similarity: 0.8, usedHeuristic: 'alias' },
          confidence: 0.8,
          reasons: ['OFF alias match for curd']
        }
      ],
      'schinken': [
        {
          food: {
            id: 'off-schinken-1',
            name: 'Schwarzwälder Schinken',
            normalizedName: 'schinken',
            macrosPer100g: { kcal: 135, protein: 24, carbs: 0.8, fat: 3.8 },
            source: 'off' as const,
            sourceId: 'off-schinken-1'
          },
          match: { exact: true, similarity: 1.0, usedHeuristic: undefined },
          confidence: 1.0,
          reasons: ['OFF exact schinken match']
        }
      ],
      'hähnchen': [
        {
          food: {
            id: 'off-haehnchen-1',
            name: 'Hähnchenbrust ohne Haut',
            normalizedName: 'hähnchen',
            macrosPer100g: { kcal: 172, protein: 32, carbs: 0, fat: 4.2 },
            source: 'off' as const,
            sourceId: 'off-haehnchen-1'
          },
          match: { exact: true, similarity: 1.0, usedHeuristic: undefined },
          confidence: 1.0,
          reasons: ['OFF exact hähnchen match']
        }
      ],
      'milch': [
        {
          food: {
            id: 'off-milch-1',
            name: 'Weihenstephan Vollmilch 3,8%',
            normalizedName: 'milch',
            macrosPer100g: { kcal: 65, protein: 3.4, carbs: 4.8, fat: 3.8 },
            source: 'off' as const,
            sourceId: 'off-milch-1'
          },
          match: { exact: true, similarity: 1.0, usedHeuristic: undefined },
          confidence: 1.0,
          reasons: ['OFF exact milch match']
        }
      ]
    };
    
    const candidates = offCandidates[input] || [];
    console.log(`SOURCE_RAW_CANDIDATES input="${input}" source="off" names=[${candidates.map(c => `"${c.food.name}"`).join(', ')}]`);
    return Promise.resolve(candidates);
  })
};

const mockUsdaSource: FoodCatalogSource = {
  type: 'usda',
  search: jest.fn().mockImplementation((query: FoodSearchQuery) => {
    const input = query.normalized;
    
    // Input-specific USDA candidates - COMPLETE coverage for all TEST_CASES
    const usdaCandidates: Record<string, any[]> = {
      'quark': [
        {
          food: {
            id: 'usda-quark-1',
            name: 'Cottage cheese, low fat',
            normalizedName: 'quark',
            macrosPer100g: { kcal: 98, protein: 11, carbs: 3.4, fat: 4.3 },
            source: 'usda' as const,
            sourceId: '01015'
          },
          match: { exact: false, similarity: 0.7, usedHeuristic: 'alias' },
          confidence: 0.7,
          reasons: ['USDA alias match (quark -> cottage cheese)']
        }
      ],
      'magerquark': [
        {
          food: {
            id: 'usda-magerquark-1',
            name: 'Cottage cheese, nonfat',
            normalizedName: 'magerquark',
            macrosPer100g: { kcal: 72, protein: 12.4, carbs: 2.7, fat: 0.3 },
            source: 'usda' as const,
            sourceId: '01016'
          },
          match: { exact: false, similarity: 0.75, usedHeuristic: 'translation' },
          confidence: 0.75,
          reasons: ['USDA translation match (magerquark -> nonfat cottage cheese)']
        }
      ],
      'frischkäse': [
        {
          food: {
            id: 'usda-frischkaese-1',
            name: 'Cream cheese',
            normalizedName: 'frischkäse',
            macrosPer100g: { kcal: 342, protein: 5.9, carbs: 4.1, fat: 34 },
            source: 'usda' as const,
            sourceId: '01017'
          },
          match: { exact: false, similarity: 0.8, usedHeuristic: 'translation' },
          confidence: 0.8,
          reasons: ['USDA translation match (frischkäse -> cream cheese)']
        }
      ],
      'cottage cheese': [
        {
          food: {
            id: 'usda-cottage-cheese-1',
            name: 'Cottage cheese, low fat',
            normalizedName: 'cottage cheese',
            macrosPer100g: { kcal: 98, protein: 11, carbs: 3.4, fat: 4.3 },
            source: 'usda' as const,
            sourceId: '01015'
          },
          match: { exact: true, similarity: 1.0, usedHeuristic: undefined },
          confidence: 1.0,
          reasons: ['USDA exact match']
        }
      ],
      'curd': [
        {
          food: {
            id: 'usda-curd-1',
            name: 'Cottage cheese, low fat',
            normalizedName: 'curd',
            macrosPer100g: { kcal: 98, protein: 11, carbs: 3.4, fat: 4.3 },
            source: 'usda' as const,
            sourceId: '01015'
          },
          match: { exact: false, similarity: 0.8, usedHeuristic: 'alias' },
          confidence: 0.8,
          reasons: ['USDA alias match for curd']
        }
      ],
      'greek yogurt': [
        {
          food: {
            id: 'usda-greek-yogurt-1',
            name: 'Yogurt, Greek, plain, nonfat',
            normalizedName: 'greek yogurt',
            macrosPer100g: { kcal: 59, protein: 10, carbs: 3.6, fat: 0.4 },
            source: 'usda' as const,
            sourceId: '01256'
          },
          match: { exact: true, similarity: 1.0, usedHeuristic: undefined },
          confidence: 1.0,
          reasons: ['USDA exact match']
        }
      ],
      'ei': [
        {
          food: {
            id: 'usda-egg-1',
            name: 'Egg, whole, raw',
            normalizedName: 'egg',
            macrosPer100g: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 },
            source: 'usda' as const,
            sourceId: '01123'
          },
          match: { exact: false, similarity: 0.9, usedHeuristic: 'translation' },
          confidence: 0.9,
          reasons: ['USDA translation match (ei -> egg)']
        }
      ],
      'eier': [
        {
          food: {
            id: 'usda-eggs-1',
            name: 'Egg, whole, raw',
            normalizedName: 'eggs',
            macrosPer100g: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 },
            source: 'usda' as const,
            sourceId: '01123'
          },
          match: { exact: false, similarity: 0.9, usedHeuristic: 'translation' },
          confidence: 0.9,
          reasons: ['USDA translation match (eier -> eggs)']
        }
      ],
      'rührei': [
        {
          food: {
            id: 'usda-scrambled-eggs-1',
            name: 'Egg, scrambled',
            normalizedName: 'scrambled eggs',
            macrosPer100g: { kcal: 149, protein: 9.9, carbs: 1.6, fat: 11 },
            source: 'usda' as const,
            sourceId: '01128'
          },
          match: { exact: false, similarity: 0.85, usedHeuristic: 'translation' },
          confidence: 0.85,
          reasons: ['USDA translation match (rührei -> scrambled eggs)']
        }
      ],
      'toast': [
        {
          food: {
            id: 'usda-toast-1',
            name: 'Bread, white, toasted',
            normalizedName: 'toast',
            macrosPer100g: { kcal: 313, protein: 9.7, carbs: 59, fat: 4.2 },
            source: 'usda' as const,
            sourceId: '18069'
          },
          match: { exact: true, similarity: 1.0, usedHeuristic: undefined },
          confidence: 1.0,
          reasons: ['USDA exact match']
        }
      ],
      'buttertoast': [
        {
          food: {
            id: 'usda-butter-toast-1',
            name: 'Bread, white, toasted, with butter',
            normalizedName: 'butter toast',
            macrosPer100g: { kcal: 378, protein: 8.9, carbs: 54, fat: 14 },
            source: 'usda' as const,
            sourceId: '18070'
          },
          match: { exact: false, similarity: 0.9, usedHeuristic: 'fuzzy' },
          confidence: 0.9,
          reasons: ['USDA fuzzy match for butter toast']
        }
      ],
      'protein quark': [
        {
          food: {
            id: 'usda-protein-cottage-1',
            name: 'Cottage cheese, low fat, high protein',
            normalizedName: 'protein cottage cheese',
            macrosPer100g: { kcal: 98, protein: 15, carbs: 3.4, fat: 2.3 },
            source: 'usda' as const,
            sourceId: '01018'
          },
          match: { exact: false, similarity: 0.75, usedHeuristic: 'alias' },
          confidence: 0.75,
          reasons: ['USDA alias match (protein quark -> high protein cottage cheese)']
        }
      ],
      'schinken': [
        {
          food: {
            id: 'usda-ham-1',
            name: 'Ham, sliced, regular',
            normalizedName: 'ham',
            macrosPer100g: { kcal: 145, protein: 21, carbs: 1.5, fat: 5.5 },
            source: 'usda' as const,
            sourceId: '07025'
          },
          match: { exact: false, similarity: 0.85, usedHeuristic: 'translation' },
          confidence: 0.85,
          reasons: ['USDA translation match (schinken -> ham)']
        }
      ],
      'hähnchen': [
        {
          food: {
            id: 'usda-chicken-1',
            name: 'Chicken, breast, meat only, cooked, roasted',
            normalizedName: 'chicken',
            macrosPer100g: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
            source: 'usda' as const,
            sourceId: '05062'
          },
          match: { exact: false, similarity: 0.85, usedHeuristic: 'translation' },
          confidence: 0.85,
          reasons: ['USDA translation match (hähnchen -> chicken)']
        }
      ],
      'milch': [
        {
          food: {
            id: 'usda-milk-1',
            name: 'Milk, reduced fat, fluid, 2% milkfat',
            normalizedName: 'milk',
            macrosPer100g: { kcal: 50, protein: 3.3, carbs: 4.8, fat: 2.0 },
            source: 'usda' as const,
            sourceId: '01077'
          },
          match: { exact: false, similarity: 0.9, usedHeuristic: 'translation' },
          confidence: 0.9,
          reasons: ['USDA translation match (milch -> milk)']
        }
      ]
    };
    
    const candidates = usdaCandidates[input] || [];
    console.log(`SOURCE_RAW_CANDIDATES input="${input}" source="usda" names=[${candidates.map(c => `"${c.food.name}"`).join(', ')}]`);
    return Promise.resolve(candidates);
  })
};

const resolver = new FusionCandidateResolver([mockBlsSource, mockOffSource, mockUsdaSource]);

describe('Fusion Scoring Calibration Matrix', () => {
  const semanticCorrectWinners: Record<string, string> = {
    quark: 'Quark, Magerstufe',
    ei: 'Ei, ganz',
    toast: 'Toastbrot',
    milch: 'Milch, 3,5% Fett',
    hähnchen: 'Hähnchenbrustfilet, roh',
    frischkäse: 'Frischkäse, Rahmstufe',
    schinken: 'Schinken, gekocht',
  };

  const calibrationReport: {
    correct: string[];
    suspicious: string[];
    wrongWinners: string[];
    ambiguous: string[];
  } = {
    correct: [],
    suspicious: [],
    wrongWinners: [],
    ambiguous: [],
  };

  let isFirstTest = true;

  TEST_CASES.forEach((input) => {
    it(`should calibrate fusion scoring for input: ${input}`, async () => {
      const query = { raw: input, normalized: input.toLowerCase(), locale: 'de' as const, traceId: `calibration-${input}` };

      const result = await resolver.resolve(query);
      
      // CALIBRATION-004: Test für gelockerten Gap-Threshold (nach resolve)
      if (input === 'ei') {
        const top1Score = (resolver as any).lastScoredCandidates[0]?.breakdown.finalScore || 0;
        const top2Score = (resolver as any).lastScoredCandidates[1]?.breakdown.finalScore || 0;
        const gap = top1Score - top2Score;
        expect(top1Score).toBeGreaterThanOrEqual(0.82);
        expect(gap).toBeGreaterThanOrEqual(0.04);
      }

      // CALIBRATION-004: Test für accepted_with_assumption (nach resolve)
      if (input === 'protein quark') {
        const top1Score = (resolver as any).lastScoredCandidates[0]?.breakdown.finalScore || 0;
        expect(top1Score).toBeGreaterThanOrEqual(0.62);
      }

      // CALIBRATION-004: Test für echte Ambiguous Fälle (nach resolve)
      if (input === 'cottage cheese') {
        const top1Score = (resolver as any).lastScoredCandidates[0]?.breakdown.finalScore || 0;
        const top2Score = (resolver as any).lastScoredCandidates[1]?.breakdown.finalScore || 0;
        const gap = top1Score - top2Score;
        expect(gap).toBeLessThan(0.04);
      }
      const candidates = result.candidates;
      const scoredCandidates = (resolver as any).lastScoredCandidates || [];

      // INTEGRITY ASSERTIONS - Fail if clearly different inputs produce identical top-3 names
      expect(candidates.length).toBeGreaterThanOrEqual(1);

      // Extract scores from lastScoredCandidates breakdown
      const scores = scoredCandidates.map(({ candidate, breakdown }: { candidate: any; breakdown: any }) => {
        return {
          id: candidate.id,
          source: candidate.source,
          displayName: candidate.name,
          finalScore: breakdown.finalScore,
          lexicalScore: breakdown.lexicalContribution,
          tokenOverlap: breakdown.tokenContribution,
          sourceTrust: breakdown.sourceTrustContribution,
          localeScore: breakdown.localeContribution,
          penalties: breakdown.totalPenalties,
        };
      });

      // Sort scores descending
      scores.sort((a: any, b: any) => b.finalScore - a.finalScore);

      // Check descending order
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i - 1].finalScore).toBeGreaterThanOrEqual(scores[i].finalScore);
      }

      // Prepare debug output
      const topCandidates = scores.slice(0, 3);
      const top1 = topCandidates[0]?.finalScore ?? 0;
      const top2 = topCandidates[1]?.finalScore ?? 0;
      const winner = topCandidates[0];

      // Store results for integrity check
      const top3Names = topCandidates.map((c: any) => c.displayName);
      const winnerName = winner?.displayName || 'none';
      globalResults[input] = { top3Names, winnerName };

      // Evaluate semantic correctness
      const expectedWinner = semanticCorrectWinners[input];
      if (winnerName === expectedWinner) {
        calibrationReport.correct.push(input);
      } else {
        // Check if winner is in top 3
        if (top3Names.includes(expectedWinner)) {
          calibrationReport.suspicious.push(input);
        } else {
          calibrationReport.wrongWinners.push(input);
        }
      }

      // Check for ambiguous cases (score gap < 0.08)
      if (top1 - top2 < 0.08) {
        calibrationReport.ambiguous.push(input);
      }

      // Log final top-3 for debugging
      console.log(`FUSION_FINAL_TOP3 input="${input}" names=[${top3Names.map((name: string) => `"${name}"`).join(', ')}]`);

      const logLines: string[] = [];
      logLines.push(`\n=== FUSION CALIBRATION: ${input} ===`);
      logLines.push('Top Candidates:');
      topCandidates.forEach((c: any, idx: any) => {
        logLines.push(`${idx + 1}) [${c.source}] name="${c.displayName}" score=${c.finalScore.toFixed(4)}`);
        logLines.push(`   lexical=${c.lexicalScore.toFixed(4)} token=${c.tokenOverlap.toFixed(4)} trust=${c.sourceTrust.toFixed(4)} locale=${c.localeScore.toFixed(4)} penalties=${c.penalties.toFixed(4)}`);
      });

      logLines.push(`Winner:`);
      logLines.push(`→ [${winner.source}] name="${winner.displayName}" score=${winner.finalScore.toFixed(4)}`);
      logLines.push(`Score Gap: ${(top1 - top2).toFixed(4)}`);
      logLines.push(`Decision: ${result.status}`);

      console.log(logLines.join('\n'));

      // Write to file - overwrite on first test, append on subsequent tests
      const fs = require('fs');
      const path = require('path');
      const logFilePath = path.resolve(__dirname, '../../../../logs/fusion_calibration.log');
      
      if (isFirstTest) {
        fs.writeFileSync(logFilePath, logLines.join('\n') + '\n\n');
        isFirstTest = false;
      } else {
        fs.appendFileSync(logFilePath, logLines.join('\n') + '\n\n');
      }

      // Edge case warnings
      if (top1 - top2 < 0.08) {
        console.warn(`[WARNING] Potential bias detected: score gap < 0.08 for input '${input}'`);
      }
      if (winner.lexicalScore < (topCandidates[1]?.lexicalScore ?? 0)) {
        console.warn(`[WARNING] Potential bias detected: winner lexical score lower than runner-up for input '${input}'`);
      }
      if (winner.sourceTrust > (topCandidates[1]?.sourceTrust ?? 0) && winner.tokenOverlap < (topCandidates[1]?.tokenOverlap ?? 0)) {
        console.warn(`[WARNING] Potential bias detected: winner from higher trust source but worse token match for input '${input}'`);
      }
    });
  });

  // INTEGRITY CHECK: Run after all individual tests
  afterAll(() => {
    console.log('\n=== INTEGRITY CHECK ===');
    
    // Check for identical winners across semantically different inputs
    const semanticallyDifferentPairs = [
      ['quark', 'ei'],
      ['quark', 'toast'],
      ['quark', 'hähnchen'],
      ['ei', 'toast'],
      ['ei', 'milch'],
      ['toast', 'hähnchen'],
      ['frischkäse', 'schinken'],
      ['milch', 'hähnchen']
    ];

    let integrityFailures = 0;

    semanticallyDifferentPairs.forEach(([input1, input2]) => {
      const result1 = globalResults[input1];
      const result2 = globalResults[input2];
      
      if (result1 && result2) {
        // Check if winners are identical
        if (result1.winnerName === result2.winnerName) {
          console.error(`[INTEGRITY FAILURE] Identical winner for semantically different inputs: "${input1}" and "${input2}" both have winner "${result1.winnerName}"`);
          integrityFailures++;
        }
        
        // Check if top-3 are identical
        const top3_1 = result1.top3Names.slice(0, 3).sort();
        const top3_2 = result2.top3Names.slice(0, 3).sort();
        if (JSON.stringify(top3_1) === JSON.stringify(top3_2)) {
          console.error(`[INTEGRITY FAILURE] Identical top-3 for semantically different inputs: "${input1}" and "${input2}" both have top-3 [${top3_1.join(', ')}]`);
          integrityFailures++;
        }
      }
    });

    // Check for specific problematic cases mentioned in the task
    const problematicInputs = ['quark', 'ei', 'toast', 'milch', 'hähnchen'];
    const allWinners = problematicInputs.map(input => globalResults[input]?.winnerName).filter(Boolean);
    const uniqueWinners = new Set(allWinners);
    
    if (uniqueWinners.size < Math.min(3, allWinners.length)) {
      console.error(`[INTEGRITY FAILURE] Too few unique winners for diverse inputs. Expected at least 3 different winners for [${problematicInputs.join(', ')}], got ${uniqueWinners.size}: [${Array.from(uniqueWinners).join(', ')}]`);
      integrityFailures++;
    }

    console.log(`\n=== INTEGRITY SUMMARY ===`);
    console.log(`Total inputs tested: ${Object.keys(globalResults).length}`);
    console.log(`Unique winners: ${new Set(Object.values(globalResults).map(r => r.winnerName)).size}`);
    console.log(`Integrity failures: ${integrityFailures}`);
    
    // Generate calibration report summary
    console.log('\n=== CALIBRATION REPORT SUMMARY ===');
    console.log(`Correct cases: ${calibrationReport.correct.join(', ')}`);
    console.log(`Suspicious cases: ${calibrationReport.suspicious.join(', ')}`);
    console.log(`Wrong winners: ${calibrationReport.wrongWinners.join(', ')}`);
    console.log(`Ambiguous cases (score gap < 0.08): ${calibrationReport.ambiguous.join(', ')}`);

    // Group issues by cause (simplified heuristic)
    const issueGroups = {
      sourceTrustTooStrong: [] as string[],
      localeTooStrong: [] as string[],
      tokenOverlapWeak: [] as string[],
      penaltiesWeak: [] as string[],
      thresholdsWeak: [] as string[],
    };

    calibrationReport.wrongWinners.forEach(input => {
      // Example heuristic grouping based on score components
      const scored = (resolver as any).lastScoredCandidates.find((c: any) => c.candidate.name === semanticCorrectWinners[input]);
      if (!scored) {
        issueGroups.sourceTrustTooStrong.push(input);
      } else {
        // Further heuristics could be added here
        issueGroups.tokenOverlapWeak.push(input);
      }
    });

    console.log('\n=== ISSUE GROUPS ===');
    console.log(`SourceTrust too strong: ${issueGroups.sourceTrustTooStrong.join(', ')}`);
    console.log(`Locale too strong: ${issueGroups.localeTooStrong.join(', ')}`);
    console.log(`Token overlap too weak/permissive: ${issueGroups.tokenOverlapWeak.join(', ')}`);
    console.log(`Penalties too weak: ${issueGroups.penaltiesWeak.join(', ')}`);
    console.log(`Thresholds/guardrail too weak: ${issueGroups.thresholdsWeak.join(', ')}`);

    // Additional checks for new rules
    const quarkResult = globalResults['quark'];
    if (quarkResult) {
      if (quarkResult.winnerName !== 'BLS Quark') {
        console.warn('Expected BLS Quark to win or ambiguous for input "quark"');
      }
    }

    const proteinQuarkResult = globalResults['protein quark'];
    if (proteinQuarkResult) {
      if (proteinQuarkResult.winnerName !== 'Correct Protein Quark') {
        console.warn('Expected correct winner for input "protein quark"');
      }
    }

    const simpleFoods = ['ei', 'milch', 'toast'];
    simpleFoods.forEach(food => {
      const result = globalResults[food];
      if (result && result.top3Names && result.top3Names.length > 0) {
        // Use a heuristic: if top 2 names are different, consider ambiguous
        const top2Different = result.top3Names[0] !== result.top3Names[1];
        if (top2Different) {
          console.warn(`Expected accepted, not ambiguous result for simple food input "${food}"`);
        }
      }
    });

    // Check for fewer universal ambiguous results
    const ambiguousCount = Object.values(globalResults).filter(r => r.top3Names && r.top3Names.length > 0 && r.top3Names[0] !== r.top3Names[1]).length;
    if (ambiguousCount > 10) {
      console.warn('Too many universal ambiguous results');
    }

    // Propose minimal numeric changes
    console.log('\n=== RECOMMENDED NEXT NUMERIC ADJUSTMENTS ===');
    console.log('- Slightly reduce sourceTrust weight for problematic inputs');
    console.log('- Adjust token overlap threshold to be more strict');
    console.log('- Increase penalties for ambiguous cases');
    
    if (integrityFailures > 0) {
      throw new Error(`Calibration integrity check failed with ${integrityFailures} failures. Different inputs are producing identical results.`);
    } else {
      console.log('✅ Calibration integrity check PASSED - Different inputs produce different results');
    }
  });
});
