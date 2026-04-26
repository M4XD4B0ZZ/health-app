/**
 * Debug Script für "zwei scheiben schinken" Problem
 * Ziel: Identifiziere warum der Test fehlschlägt
 */

// Simuliere die relevanten Teile der Logik
const canonicalFoods = [
  {
    id: 'ham',
    aliases: {
      de: ['schinken'],
      en: ['ham'],
    },
    defaultPortion: {
      unit: 'gram',
      grams: 30,
    },
  },
];

function detectCanonicalEntity(input) {
  const normalizedInput = input.toLowerCase().trim();

  for (const food of canonicalFoods) {
    if (food.aliases.de.includes(normalizedInput) || food.aliases.en.includes(normalizedInput)) {
      return food;
    }
  }

  return null;
}

function parseInput(text) {
  const normalized = text.trim().toLowerCase();

  // "zwei scheiben schinken" -> name: "schinken", quantityCount: 2
  if (normalized.includes('zwei scheiben')) {
    return { name: 'schinken', quantityCount: 2 };
  }

  return { name: normalized };
}

function calculateQuantity(parsed, canonicalEntity) {
  let quantityGrams = 0;
  let quantitySource = 'unknown';

  if (parsed.quantityGrams !== undefined) {
    quantityGrams = parsed.quantityGrams;
    quantitySource = 'explicit_grams';
  } else if (parsed.quantityCount !== undefined && canonicalEntity?.defaultPortion?.grams) {
    // Support both 'piece' and 'gram' units for quantityCount
    quantityGrams = parsed.quantityCount * canonicalEntity.defaultPortion.grams;
    quantitySource = 'count_x_default';
  } else if (parsed.quantityCount !== undefined) {
    // Nur Count, keine Gramm-Angabe
    quantityGrams = 0;
    quantitySource = 'count_no_default';
  } else {
    // Fallback auf default portion
    if (canonicalEntity?.defaultPortion?.grams) {
      quantityGrams = canonicalEntity.defaultPortion.grams;
      quantitySource = 'default_portion';
    }
  }

  return { quantityGrams, quantitySource };
}

// Test "zwei scheiben schinken"
console.log('='.repeat(60));
console.log('DEBUG: "zwei scheiben schinken"');
console.log('='.repeat(60));

const input = 'zwei scheiben schinken';
console.log(`Input: "${input}"`);

// 1. Parse
const parsed = parseInput(input);
console.log('Parsed:', JSON.stringify(parsed, null, 2));

// 2. Detect Canonical Entity
const canonicalEntity = detectCanonicalEntity(parsed.name);
console.log(
  'Canonical Entity:',
  canonicalEntity
    ? {
        id: canonicalEntity.id,
        defaultPortion: canonicalEntity.defaultPortion,
      }
    : 'NOT FOUND',
);

// 3. Calculate Quantity
const { quantityGrams, quantitySource } = calculateQuantity(parsed, canonicalEntity);
console.log(`Quantity: ${quantityGrams}g (${quantitySource})`);

// 4. Check Zero-Macro Block
const zeroMacroBlock = quantityGrams === 0;
console.log(`Zero-Macro Block: ${zeroMacroBlock ? '❌ BLOCKED' : '✅ ALLOWED'}`);

// 5. Simulate Macros (125 kcal per 100g for ham)
const estimatedKcal = quantityGrams > 0 ? Math.round((125 * quantityGrams) / 100) : 0;
console.log(`Estimated Kcal: ${estimatedKcal}`);

// 6. Final Success Check
const success = !zeroMacroBlock && quantityGrams > 0 && estimatedKcal > 0;
console.log(`Final Success: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);

console.log('\n' + '='.repeat(60));
console.log('ANALYSIS');
console.log('='.repeat(60));

if (success) {
  console.log('✅ "zwei scheiben schinken" sollte funktionieren!');
  console.log(`   - Parsed name: "${parsed.name}"`);
  console.log(`   - Canonical entity found: ${canonicalEntity?.id}`);
  console.log(
    `   - Quantity calculation: ${parsed.quantityCount} × ${canonicalEntity?.defaultPortion?.grams}g = ${quantityGrams}g`,
  );
  console.log(`   - Estimated macros: ${estimatedKcal} kcal`);
} else {
  console.log('❌ "zwei scheiben schinken" hat ein Problem:');

  if (!canonicalEntity) {
    console.log('   - Canonical entity nicht gefunden');
  }

  if (zeroMacroBlock) {
    console.log('   - Zero-Macro Block aktiviert');
    console.log(`   - quantityGrams = ${quantityGrams}`);
    console.log(`   - parsed.quantityCount = ${parsed.quantityCount}`);
    console.log(
      `   - canonicalEntity.defaultPortion.grams = ${canonicalEntity?.defaultPortion?.grams}`,
    );
  }

  if (estimatedKcal === 0) {
    console.log('   - Keine Kalorien berechnet');
  }
}
