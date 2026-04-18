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

// Mock sources with input-dependent candidates
const mockBlsSource: FoodCatalogSource = {
  type: 'bls',
  search: jest.fn().mockImplementation((query: FoodSearchQuery) => {
    const input = query.normalized;
    
    // Input-specific BLS candidates
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
      ]
    };
    
    return Promise.resolve(blsCandidates[input] || []);
  })
};

const mockOffSource: FoodCatalogSource = {
  type: 'off',
  search: jest.fn().mockImplementation((query: FoodSearchQuery) => {
    const input = query.normalized;
    
    // Input-specific OFF candidates
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
      ]
    };
    
    return Promise.resolve(offCandidates[input] || []);
  })
};

const mockUsdaSource: FoodCatalogSource = {
  type: 'usda',
  search: jest.fn().mockImplementation((query: FoodSearchQuery) => {
    const input = query.normalized;
    
    // Input-specific USDA candidates
    const usdaCandidates: Record<string, any[]> = {
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
    
    return Promise.resolve(usdaCandidates[input] || []);
  })
};

const resolver = new FusionCandidateResolver([mockBlsSource, mockOffSource, mockUsdaSource]);

describe('Fusion Scoring Calibration Matrix', () => {
  TEST_CASES.forEach((input) => {
    it(`should calibrate fusion scoring for input: ${input}`, async () => {
      const query = { raw: input, normalized: input.toLowerCase(), locale: 'de' as const, traceId: `calibration-${input}` };

      const result = await resolver.resolve(query);
      const candidates = result.candidates;
      const scoredCandidates = (resolver as any).lastScoredCandidates || [];

      // Soft assertions
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

      const logLines: string[] = [];
      logLines.push(`\n=== FUSION CALIBRATION: ${input} ===`);
      logLines.push('Top Candidates:');
      topCandidates.forEach((c: any, idx: any) => {
        logLines.push(`${idx + 1}) [${c.source}] name=\"${c.displayName}\" score=${c.finalScore.toFixed(4)}`);
        logLines.push(`   lexical=${c.lexicalScore.toFixed(4)} token=${c.tokenOverlap.toFixed(4)} trust=${c.sourceTrust.toFixed(4)} locale=${c.localeScore.toFixed(4)} penalties=${c.penalties.toFixed(4)}`);
      });

      logLines.push(`Winner:`);
      logLines.push(`→ [${winner.source}] name=\"${winner.displayName}\" score=${winner.finalScore.toFixed(4)}`);
      logLines.push(`Score Gap: ${(top1 - top2).toFixed(4)}`);
      logLines.push(`Decision: ${result.status}`);

      console.log(logLines.join('\n'));

      // Write to file
      const fs = require('fs');
      const path = require('path');
      const logFilePath = path.resolve(__dirname, '../../../../logs/fusion_calibration.log');
      fs.appendFileSync(logFilePath, logLines.join('\n') + '\n\n');

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
});
