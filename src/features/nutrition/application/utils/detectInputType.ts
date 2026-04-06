// Minimal Input Classification Layer for Nutrition Resolver

const knownBrands = new Set([
  'milka',
  'nutella',
  'oreo',
  // Add more known brand keywords here
]);

const genericFoods = new Set([
  'apple',
  'banana',
  'egg',
  'bread',
  'milk',
  'cheese',
  'rice',
  'chicken',
  'beef',
  'carrot',
  'potato',
  'tomato',
  'onion',
  'butter',
  'quark',
  'magerquark',
  'frischkaese',
  'frischkäse',
  'ruehrei',
  'rührei',
  'toast',
  'toastbrot',
  'buttertoast',
  // Add more generic food keywords here
]);

export function detectInputType(rawInput: string): 'generic' | 'branded' | 'ambiguous' {
  const normalized = rawInput.toLowerCase();

  for (const brand of knownBrands) {
    if (normalized.includes(brand)) {
      const inputType = 'branded';
      console.log(`[DEBUG] INPUT TYPE: "${rawInput}" => ${inputType}`);
      return inputType;
    }
  }

  for (const generic of genericFoods) {
    if (normalized.includes(generic)) {
      const inputType = 'generic';
      console.log(`[DEBUG] INPUT TYPE: "${rawInput}" => ${inputType}`);
      return inputType;
    }
  }

  const inputType = 'ambiguous';
  console.log(`[DEBUG] INPUT TYPE: "${rawInput}" => ${inputType}`);
  return inputType;
}
