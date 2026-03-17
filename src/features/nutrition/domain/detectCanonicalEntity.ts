import { CANONICAL_FOODS, CanonicalFood } from "./canonicalFoods";

export function detectCanonicalEntity(input: string): CanonicalFood | null {
  const normalizedInput = input.toLowerCase().trim();

  for (const food of CANONICAL_FOODS) {
    if (
      food.aliases.de.includes(normalizedInput) ||
      food.aliases.en.includes(normalizedInput)
    ) {
      return food;
    }
  }

  return null;
}
