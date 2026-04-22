// Debug Test für detectCanonicalEntity mit "schinken"

const CANONICAL_FOODS = [
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
    sourceQueries: {
      usda: 'ham',
      off: 'ham',
    },
  },
  {
    id: 'egg',
    aliases: {
      de: ['ei', 'eier'],
      en: ['egg', 'eggs'],
    },
    defaultPortion: {
      unit: 'piece',
      grams: 60,
    },
    sourceQueries: {
      usda: 'egg',
      off: 'egg',
    },
  }
];

function detectCanonicalEntity(input) {
  const normalizedInput = input.toLowerCase().trim();

  for (const food of CANONICAL_FOODS) {
    if (food.aliases.de.includes(normalizedInput) || food.aliases.en.includes(normalizedInput)) {
      return food;
    }
  }

  return null;
}

// Test
console.log('=== CANONICAL ENTITY TEST ===');

const testInputs = ['schinken', 'ei', 'eier', 'ham'];

testInputs.forEach(input => {
  const result = detectCanonicalEntity(input);
  console.log(`Input: "${input}"`);
  console.log(`Result:`, result ? {
    id: result.id,
    defaultPortion: result.defaultPortion
  } : null);
  console.log('---');
});

// Spezifischer Test für "zwei scheiben schinken" Flow
console.log('\n=== ZWEI SCHEIBEN SCHINKEN FLOW ===');

const rawInput = 'zwei scheiben schinken';
const parsedName = 'schinken'; // vom Parser
const quantityCount = 2; // vom Parser

console.log(`Raw Input: "${rawInput}"`);
console.log(`Parsed Name: "${parsedName}"`);
console.log(`Quantity Count: ${quantityCount}`);

const canonicalEntity = detectCanonicalEntity(parsedName);
console.log(`Canonical Entity:`, canonicalEntity ? {
  id: canonicalEntity.id,
  defaultPortion: canonicalEntity.defaultPortion
} : null);

if (canonicalEntity?.defaultPortion?.unit === 'piece' && canonicalEntity.defaultPortion.grams) {
  const quantityGrams = quantityCount * canonicalEntity.defaultPortion.grams;
  console.log(`✅ Calculated quantityGrams: ${quantityGrams}`);
} else if (canonicalEntity?.defaultPortion?.unit === 'gram' && canonicalEntity.defaultPortion.grams) {
  const quantityGrams = quantityCount * canonicalEntity.defaultPortion.grams;
  console.log(`✅ Calculated quantityGrams: ${quantityGrams}`);
} else {
  console.log(`❌ No valid defaultPortion found - would set quantityGrams = 0`);
}