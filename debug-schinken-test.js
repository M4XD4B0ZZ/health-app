// Debug Test für "zwei scheiben schinken" Problem

// Simuliere Parser
const mockParser = {
  parse: (text) => {
    const normalized = text.trim().toLowerCase();

    // "zwei scheiben schinken" -> name: "schinken", quantityCount: 2
    if (normalized.includes('zwei scheiben')) {
      return { name: 'schinken', quantityCount: 2 };
    }

    return { name: normalized };
  },
};

// Simuliere Resolver
const mockResolver = {
  resolve: async (query) => {
    const { normalized } = query;

    const proofResults = {
      schinken: {
        candidates: [
          {
            food: {
              id: 'bls-schinken-001',
              name: 'Schinken, gekocht',
              macrosPer100g: { kcal: 125, protein: 20.5, carbs: 0.5, fat: 4.2 },
              sourceId: 'bls-source',
              normalizedName: 'schinken',
            },
            score: 0.82,
            source: 'BLS',
            reasonCodes: ['BLS_EXACT_MATCH'],
            breakdown: { notes: ['German BLS exact match'] },
          },
        ],
        best: {
          food: {
            id: 'bls-schinken-001',
            name: 'Schinken, gekocht',
            macrosPer100g: { kcal: 125, protein: 20.5, carbs: 0.5, fat: 4.2 },
            sourceId: 'bls-source',
            normalizedName: 'schinken',
          },
          score: 0.82,
          source: 'BLS',
          reasonCodes: ['BLS_EXACT_MATCH'],
          breakdown: { notes: ['German BLS exact match'] },
        },
        reasonCodes: ['BLS_EXACT_MATCH'],
      },
    };

    const result = proofResults[normalized];
    if (result) {
      console.log(`✅ Resolver SUCCESS for "${normalized}"`);
      return result;
    }

    console.log(`❌ Resolver NO_MATCH for "${normalized}"`);
    return {
      candidates: [],
      best: null,
      reasonCodes: ['NO_MATCH'],
    };
  },
};

// Test
async function testSchinken() {
  console.log('=== DEBUG: "zwei scheiben schinken" ===');

  const input = 'zwei scheiben schinken';
  console.log(`Input: "${input}"`);

  // 1. Parser Test
  const parsed = mockParser.parse(input);
  console.log(`Parser result:`, parsed);

  // 2. Resolver Test
  const resolverResult = await mockResolver.resolve({
    raw: input,
    normalized: parsed.name,
    locale: 'de',
  });
  console.log(`Resolver result:`, resolverResult);

  // 3. Check Success Conditions
  const hasValidResult = resolverResult.best && resolverResult.best.score >= 0.7;
  const hasValidMacros = resolverResult.best?.food?.macrosPer100g?.kcal > 0;

  console.log(`\n=== ANALYSIS ===`);
  console.log(`Has valid result: ${hasValidResult}`);
  console.log(`Has valid macros: ${hasValidMacros}`);
  console.log(`Expected success: ${hasValidResult && hasValidMacros}`);
}

testSchinken().catch(console.error);
